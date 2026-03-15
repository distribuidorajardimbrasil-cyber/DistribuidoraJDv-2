import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Clock, Truck, CheckCircle2, MoreVertical, Filter, Trash2, ShieldAlert, Edit2, Plus, Minus, X } from 'lucide-react';
import { Profile, Order, Category, Product } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Gás', emoji: '📦' },
  { id: 2, name: 'Água 20L', emoji: '💧' },
  { id: 3, name: 'Água de coco', emoji: '🥥' },
  { id: 4, name: 'Refrigerante', emoji: '🥤' }
];

interface OrdersProps {
  profile?: Profile;
  isFinanceMode?: boolean;
}

export default function Orders({ profile, isFinanceMode }: OrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(isFinanceMode ? 'Pendente' : 'Ativos');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editCart, setEditCart] = useState<{ product: Product, quantity: number, customPrice: number | string }[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchCategories();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data as Product[]);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const getEmoji = (catName: string) => {
    return categories.find(c => c.name === catName)?.emoji || '📦';
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(name, address, phone, notes), items:order_items(id, product_id, quantity, price_at_time, product:products(name, category, price_sell, stock_quantity))')
      .order('created_at', { ascending: false });

    if (data) {
      const formattedData = data.map((o: any) => ({
        ...o,
        customer_name: o.customer?.name || null,
        customer_address: o.customer?.address || null,
        customer_phone: o.customer?.phone || null,
        customer_notes: o.customer?.notes || null,
        items: o.items?.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_time: item.price_at_time,
          product_name: item.product?.name || 'Produto Desconhecido',
          product_category: item.product?.category || '',
          product_stock: item.product?.stock_quantity || 0,
          product_price: item.product?.price_sell || 0
        })) || []
      }));
      setOrders(formattedData);
    }
  };

  const updateStatus = async (id: number, type: 'payment' | 'delivery', value: string) => {
    if (type === 'payment' && profile?.role === 'entregador') {
      alert('Entregadores não podem alterar o status de pagamento.');
      return;
    }

    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    if (!order) return;

    if (type === 'payment') {
      if (value === 'Pago' && order.payment_status !== 'Pago') {
        const { data: items } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', id);

        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const allowedBrands = ['GAMBOA', 'INDAIA', 'ITAGY', 'ITAGI', 'JORDAO', 'MAIORCA'];

        let waterCount = 0;
        if (items) {
          for (const item of items) {
            const { data: prod } = await supabase.from('products').select('name, stock_quantity, category').eq('id', item.product_id).single();
            if (prod) {
              const searchString = normalize(`${prod.name || ""} ${prod.category || ""}`);
              const isAllowedBrand = allowedBrands.some(brand => searchString.includes(brand));
              const isWater20L = searchString.includes("AGUA") && (searchString.includes("20L") || searchString.includes("20 L") || searchString.includes("20LITROS") || searchString.includes("20 LITROS"));

              if (isAllowedBrand && isWater20L) {
                waterCount += item.quantity;
              }

              // Update stock
              await supabase.from('products').update({ stock_quantity: (prod.stock_quantity || 0) - item.quantity }).eq('id', item.product_id);

              // Movement
              await supabase.from('stock_movements').insert([{
                product_id: item.product_id,
                type: 'out',
                quantity: item.quantity,
                reason: 'Venda (Confirmada)'
              }]);
            }
          }
        }

        // Loyalty
        if (order.customer_id) {
          const { data: cData } = await supabase.from('customers').select('loyalty_count').eq('id', order.customer_id).single();
          if (cData) {
            await supabase.from('customers').update({ loyalty_count: (cData.loyalty_count || 0) + waterCount }).eq('id', order.customer_id);
          }
        }

        // Cleanup stale dupes just in case
        await supabase.from('transactions').delete().like('description', `%Pedido #${id}`);

        // Transaction
        await supabase.from('transactions').insert([{
          type: 'income',
          amount: order.total_amount,
          description: `Pagamento Pedido #${id}`
        }]);
      } else if (value === 'Pendente' && order.payment_status === 'Pago') {
        // REVERSAL LOGIC
        const { data: items } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', id);

        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const allowedBrands = ['GAMBOA', 'INDAIA', 'ITAGY', 'ITAGI', 'JORDAO', 'MAIORCA'];

        let waterCount = 0;
        if (items) {
          for (const item of items) {
            const { data: prod } = await supabase.from('products').select('name, stock_quantity, category').eq('id', item.product_id).single();
            if (prod) {
              const searchString = normalize(`${prod.name || ""} ${prod.category || ""}`);
              const isAllowedBrand = allowedBrands.some(brand => searchString.includes(brand));
              const isWater20L = searchString.includes("AGUA") && (searchString.includes("20L") || searchString.includes("20 L") || searchString.includes("20LITROS") || searchString.includes("20 LITROS"));

              if (isAllowedBrand && isWater20L) {
                waterCount += item.quantity;
              }

              // Restore stock
              await supabase.from('products').update({ stock_quantity: (prod.stock_quantity || 0) + item.quantity }).eq('id', item.product_id);

              // Movement
              await supabase.from('stock_movements').insert([{
                product_id: item.product_id,
                type: 'in',
                quantity: item.quantity,
                reason: 'Reversão de Venda (Pendente)'
              }]);
            }
          }
        }

        // Loyalty
        if (order.customer_id) {
          const { data: cData } = await supabase.from('customers').select('loyalty_count').eq('id', order.customer_id).single();
          if (cData) {
            await supabase.from('customers').update({ loyalty_count: Math.max(0, (cData.loyalty_count || 0) - waterCount) }).eq('id', order.customer_id);
          }
        }

        // Remove Transaction
        await supabase.from('transactions').delete().like('description', `%Pedido #${id}`);
      }
    }

    // 2. Perform the update
    const updates: any = {};
    if (type === 'payment') {
      updates.payment_status = value;
    } else {
      updates.delivery_status = value;
      if (profile?.role === 'entregador' && (value === 'Saiu para entrega' || value === 'Entregue')) {
        updates.deliveryman_id = profile.id;
      }
    }

    const { error } = await supabase.from('orders').update(updates).eq('id', id);
    if (!error) fetchOrders();
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    setIsDeleting(true);

    try {
      // 0. Reverse stock, movements, loyalty, and transactions if the order was "Pago"
      if (selectedOrder.payment_status === 'Pago') {
        const { data: items } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', selectedOrder.id);
        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const allowedBrands = ['GAMBOA', 'INDAIA', 'ITAGY', 'ITAGI', 'JORDAO', 'MAIORCA'];

        let waterCount = 0;
        if (items) {
          for (const item of items) {
            const { data: prod } = await supabase.from('products').select('name, stock_quantity, category').eq('id', item.product_id).single();
            if (prod) {
              const searchString = normalize(`${prod.name || ""} ${prod.category || ""}`);
              const isAllowedBrand = allowedBrands.some(brand => searchString.includes(brand));
              const isWater20L = searchString.includes("AGUA") && (searchString.includes("20L") || searchString.includes("20 L") || searchString.includes("20LITROS") || searchString.includes("20 LITROS"));

              if (isAllowedBrand && isWater20L) {
                waterCount += item.quantity;
              }

              // Restore stock
              await supabase.from('products').update({ stock_quantity: (prod.stock_quantity || 0) + item.quantity }).eq('id', item.product_id);

              // Movement
              await supabase.from('stock_movements').insert([{
                product_id: item.product_id,
                type: 'in',
                quantity: item.quantity,
                reason: 'Reversão de Venda (Pedido Excluído)'
              }]);
            }
          }
        }

        // Loyalty
        if (selectedOrder.customer_id) {
          const { data: cData } = await supabase.from('customers').select('loyalty_count').eq('id', selectedOrder.customer_id).single();
          if (cData) {
            await supabase.from('customers').update({ loyalty_count: Math.max(0, (cData.loyalty_count || 0) - waterCount) }).eq('id', selectedOrder.customer_id);
          }
        }

        // Remove Transaction
        await supabase.from('transactions').delete().like('description', `%Pedido #${selectedOrder.id}`);
      }

      // 1. Delete order items first
      await supabase.from('order_items').delete().eq('order_id', selectedOrder.id);

      // 2. Delete the order
      const { error } = await supabase.from('orders').delete().eq('id', selectedOrder.id);

      if (!error) {
        setIsDeleteModalOpen(false);
        fetchOrders();
      }
    } catch (err) {
      console.error("Erro ao excluir pedido:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    const initialCart = order.items?.map((i: any) => {
      const p = products.find(prod => prod.id === i.product_id) || {
        id: i.product_id, name: i.product_name, category: i.product_category, price_sell: i.product_price, stock_quantity: i.product_stock
      } as unknown as Product;
      return { product: p, quantity: i.quantity, customPrice: i.price_at_time };
    }) || [];
    setEditCart(initialCart);
    setEditNotes(order.notes || '');
    setProductSearch('');
    setIsEditModalOpen(true);
  };

  const saveEditOrder = async () => {
    if (!editingOrder || editCart.length === 0) return;
    setIsSavingEdit(true);

    const newTotal = editCart.reduce((acc, item) => acc + ((Number(item.customPrice) || 0) * item.quantity), 0);

    try {
      // 1. Delete old items
      await supabase.from('order_items').delete().eq('order_id', editingOrder.id);

      // 2. Insert new items
      for (const item of editCart) {
        await supabase.from('order_items').insert([{
          order_id: editingOrder.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price_at_time: Number(item.customPrice) || 0
        }]);
      }

      // 3. Update total amount and notes on order
      await supabase.from('orders').update({ total_amount: newTotal, notes: editNotes }).eq('id', editingOrder.id);

      setIsEditModalOpen(false);
      fetchOrders();
    } catch (err) {
      console.error("Erro ao editar pedido:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const addToEditCart = (product: Product) => {
    const existing = editCart.find(item => item.product.id === product.id);
    if (existing) {
      setEditCart(editCart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setEditCart([...editCart, { product, quantity: 1, customPrice: product.price_sell }]);
    }
  };

  const removeFromEditCart = (productId: number) => {
    const existing = editCart.find(item => item.product.id === productId);
    if (existing && existing.quantity > 1) {
      setEditCart(editCart.map(item => item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item));
    } else {
      setEditCart(editCart.filter(item => item.product.id !== productId));
    }
  };

  const updateEditCustomPrice = (productId: number, val: string) => {
    setEditCart(editCart.map(item => item.product.id === productId ? { ...item, customPrice: val } : item));
  };

  const filteredOrders = orders.filter(o => {
    if (profile?.role === 'entregador') {
      // Drivers only see orders when filter is 'Todos' or they are tracking delivered/active
      if (filterStatus === 'Ativos' && o.delivery_status === 'Entregue') {
        return false;
      }
      if (filterStatus === 'Histórico' && o.delivery_status !== 'Entregue') {
        return false;
      }
    }

    const matchesSearch = (o.customer_name || 'Consumidor Final').toLowerCase().includes(searchTerm.toLowerCase()) || o.id.toString().includes(searchTerm);

    if (profile?.role === 'entregador') {
      return matchesSearch;
    }

    let matchesFilter = true;
    if (filterStatus === 'Ativos') {
      matchesFilter = o.delivery_status !== 'Entregue';
    } else if (filterStatus === 'Histórico') {
      matchesFilter = o.delivery_status === 'Entregue';
    } else if (filterStatus !== 'Todos') {
      matchesFilter = o.delivery_status === filterStatus || o.payment_status === filterStatus;
    }

    return matchesSearch && matchesFilter;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{isFinanceMode ? 'Gestão de Pagamentos' : 'Pedidos'}</h2>
          <p className="text-zinc-500">{isFinanceMode ? 'Gerencie pendências e pagamentos de pedidos.' : 'Acompanhe e gerencie as entregas.'}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-3">
          <Search className="text-zinc-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente ou Nº do pedido..."
            className="flex-1 bg-transparent border-none outline-none text-zinc-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-3">
          <Filter className="text-zinc-400" size={20} />
          <select
            className="bg-transparent border-none outline-none text-zinc-900 font-medium"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="Ativos">Pedidos Ativos</option>
            <option value="Histórico">Histórico (Entregues)</option>
            {profile?.role !== 'entregador' && (
              <>
                <option value="Todos">Todos os Pedidos</option>
                {isFinanceMode && (
                  <>
                    <option value="Pendente">Apenas Pendentes</option>
                    <option value="Pago">Apenas Pagos</option>
                  </>
                )}
                {!isFinanceMode && (
                  <>
                    <option value="Em preparo">Em preparo</option>
                    <option value="Saiu para entrega">Saiu para entrega</option>
                    <option value="Entregue">Apenas Entregues</option>
                  </>
                )}
              </>
            )}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.map(order => (
          <div key={order.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 flex-shrink-0">
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">Pedido #{order.id}</h3>
                    <span className="text-xs text-zinc-400 font-medium">• {new Date(order.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-zinc-600 font-medium">{order.customer_name || 'Consumidor Final'}</p>

                  {order.customer_address && (
                    <p className="text-sm text-zinc-500 mt-1 flex flex-col md:flex-row md:items-center gap-1">
                      <span>📍 {order.customer_address}</span>
                      {order.customer_phone && (
                        <a
                          href={`https://wa.me/55${order.customer_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 font-medium text-xs ml-0 md:ml-2 inline-flex items-center gap-1 shrink-0"
                          title="Chamar no WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📱 WhatsApp
                        </a>
                      )}
                    </p>
                  )}

                  {/* Customer Notes */}
                  {order.customer_notes && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded-lg inline-block">
                      <strong>Obs. Cliente:</strong> {order.customer_notes}
                    </div>
                  )}

                  {/* Order Notes */}
                  {order.notes && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs p-2 rounded-lg inline-block md:ml-2">
                      <strong>Obs. Pedido:</strong> {order.notes}
                    </div>
                  )}

                  {/* Items List */}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-3 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Itens do Pedido</p>
                      <ul className="space-y-1">
                        {order.items.map(item => (
                          <li key={item.id} className="text-sm text-zinc-700 flex items-center gap-2">
                            <span className="font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200 text-xs">
                              {item.quantity}x
                            </span>
                            <span className="truncate">
                              {item.product_category ? `${item.product_category} ${item.product_name}` : item.product_name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {profile?.role !== 'entregador' && (
                    <p className="text-emerald-600 font-bold text-lg mt-3">{formatCurrency(order.total_amount)} <span className="text-xs text-zinc-400 font-normal">({order.payment_method})</span></p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                {(isFinanceMode || profile?.role === 'admin') && isFinanceMode && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Pagamento</label>
                    <select
                      value={order.payment_status}
                      onChange={(e) => updateStatus(order.id, 'payment', e.target.value)}
                      className={`text-xs font-bold px-3 py-2 rounded-xl outline-none border-none cursor-pointer ${order.payment_status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Pago">Pago</option>
                    </select>
                  </div>
                )}

                {(!isFinanceMode) && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Entrega</label>
                    <select
                      value={order.delivery_status}
                      onChange={(e) => updateStatus(order.id, 'delivery', e.target.value)}
                      className={`text-xs font-bold px-3 py-2 rounded-xl outline-none border-none cursor-pointer ${order.delivery_status === 'Entregue' ? 'bg-blue-100 text-blue-700' :
                        order.delivery_status === 'Saiu para entrega' ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-700'
                        }`}
                    >
                      <option value="Em preparo">Em preparo</option>
                      <option value="Saiu para entrega">Saiu para entrega</option>
                      <option value="Entregue">Entregue</option>
                    </select>
                  </div>
                )}

                {!isFinanceMode && profile?.role !== 'entregador' && (
                  <div className="flex items-center gap-1 ml-2 border-l border-zinc-100 pl-3">
                    {order.payment_status === 'Pendente' && (
                      <button
                        onClick={() => openEditModal(order)}
                        className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Editar Pedido"
                      >
                        <Edit2 size={20} />
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedOrder(order); setIsDeleteModalOpen(true); }}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Excluir Pedido"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100">
            <ShoppingCart size={48} className="mx-auto text-zinc-200 mb-4" />
            <p className="text-zinc-500 font-medium">Nenhum pedido encontrado.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:p-6 max-w-sm p-8 shadow-2xl border border-red-100 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Excluir Pedido?</h3>
            <p className="text-zinc-500 text-sm mb-8">
              Confirma a exclusão permanente do <strong>Pedido #{selectedOrder?.id}</strong>?
              <br /><br />
              <span className="text-red-600 text-[10px] font-bold uppercase">
                ⚠️ Aviso: Estoque e pontos já processados não serão revertidos automaticamente.
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <button
                disabled={isDeleting}
                onClick={handleDeleteOrder}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-2 text-zinc-400 font-bold hover:text-zinc-600 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Edit2 size={20} className="text-emerald-600" />
                  Editar Pedido #{editingOrder?.id}
                </h3>
                <p className="text-sm text-zinc-500 font-medium mt-1">{editingOrder?.customer_name || 'Consumidor Final'}</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Product Selection */}
              <div>
                <h4 className="font-bold mb-4 text-zinc-800">Adicionar Produtos</h4>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar produto..."
                    className="w-full pl-10 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500 text-sm"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(product => (
                    <button
                      key={product.id}
                      onClick={() => addToEditCart(product)}
                      className="w-full flex items-center justify-between p-3 bg-white border border-zinc-100 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-bold text-sm text-zinc-800">{product.name}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">{product.category}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600">R$ {product.price_sell.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Cart */}
              <div className="flex flex-col">
                <h4 className="font-bold mb-4 text-zinc-800">Itens Atuais do Pedido</h4>
                <div className="flex-1 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {editCart.map(item => (
                    <div key={item.product.id} className="flex flex-col gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-zinc-900">{item.product.name}</p>
                        <div className="flex items-center gap-2 bg-white rounded-lg border border-zinc-200 p-1">
                          <button onClick={() => removeFromEditCart(item.product.id)} className="p-1 hover:bg-zinc-100 rounded-md text-zinc-500"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                          <button onClick={() => addToEditCart(item.product)} className="p-1 hover:bg-zinc-100 rounded-md text-emerald-600"><Plus size={14} /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 font-bold">Unidade: R$</span>
                        <input
                          type="number" step="0.01"
                          className="w-20 px-2 py-1 text-xs bg-white border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 font-bold text-emerald-700"
                          value={item.customPrice}
                          onChange={(e) => updateEditCustomPrice(item.product.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  {editCart.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">Nenhum item no pedido.</p>}
                </div>

                <div className="mt-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Observação (Opcional)</label>
                  <textarea
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500 text-sm resize-none"
                    placeholder="Ex: Troco para 50, entregar na portaria..."
                    rows={2}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-zinc-500">Novo Total</span>
                    <span className="text-xl font-black text-emerald-600">
                      R$ {editCart.reduce((acc, item) => acc + ((Number(item.customPrice) || 0) * item.quantity), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveEditOrder}
                      disabled={editCart.length === 0 || isSavingEdit}
                      className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
                    >
                      {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
