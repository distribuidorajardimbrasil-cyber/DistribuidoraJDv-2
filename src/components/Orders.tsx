import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Clock, Truck, CheckCircle2, MoreVertical, Filter, Trash2, ShieldAlert } from 'lucide-react';
import { Profile, Order, Category } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Gás', emoji: '📦' },
  { id: 2, name: 'Água 20L', emoji: '💧' },
  { id: 3, name: 'Água de coco', emoji: '🥥' },
  { id: 4, name: 'Refrigerante', emoji: '🥤' }
];

interface OrdersProps {
  profile?: Profile;
}

export default function Orders({ profile }: OrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Ativos');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchCategories();
  }, []);

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
      .select('*, customer:customers(name, address, phone), items:order_items(id, quantity, price_at_time, product:products(name))')
      .order('created_at', { ascending: false });

    if (data) {
      const formattedData = data.map((o: any) => ({
        ...o,
        customer_name: o.customer?.name || null,
        customer_address: o.customer?.address || null,
        customer_phone: o.customer?.phone || null,
        items: o.items?.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          price_at_time: item.price_at_time,
          product_name: item.product?.name || 'Produto Desconhecido'
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

    // 1. Check if we are changing payment to "Pago"
    if (type === 'payment' && value === 'Pago') {
      const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
      if (order && order.payment_status !== 'Pago') {
        // Fetch items
        const { data: items } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', id);

        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const allowedBrandsNormalized = ['GAMBOA', 'INDAIA', 'ITAGY', 'ITAGI', 'JORDAO', 'MAIORCA'];

        let waterCount = 0;
        if (items) {
          for (const item of items) {
            const { data: prod } = await supabase.from('products').select('name, stock_quantity, category').eq('id', item.product_id).single();
            if (prod) {
              const prodName = prod.name || "";
              const prodCategory = prod.category || "";
              const searchString = normalize(`${prodName} ${prodCategory}`);

              const allowedBrands = ['GAMBOA', 'INDAIA', 'ITAGY', 'ITAGI', 'JORDAO', 'MAIORCA'];
              const isAllowedBrand = allowedBrands.some(brand => searchString.includes(brand));

              const hasAgua = searchString.includes("AGUA");
              const has20L =
                searchString.includes("20L") ||
                searchString.includes("20 L") ||
                searchString.includes("20LITROS") ||
                searchString.includes("20 LITROS");

              const isWater20L = hasAgua && has20L;

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

        // Transaction
        await supabase.from('transactions').insert([{
          type: 'income',
          amount: order.total_amount,
          description: `Pagamento Pedido #${id}`
        }]);
      }
    }

    // 2. Perform the update
    const updates: any = {};
    if (type === 'payment') updates.payment_status = value;
    else updates.delivery_status = value;

    const { error } = await supabase.from('orders').update(updates).eq('id', id);
    if (!error) fetchOrders();
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    setIsDeleting(true);

    try {
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

  const filteredOrders = orders.filter(o => {
    if (profile?.role === 'entregador' && o.delivery_status === 'Entregue') {
      return false;
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
          <h2 className="text-2xl font-bold">Pedidos</h2>
          <p className="text-zinc-500">Acompanhe e gerencie as vendas e entregas.</p>
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
        {profile?.role !== 'entregador' && (
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-3">
            <Filter className="text-zinc-400" size={20} />
            <select
              className="bg-transparent border-none outline-none text-zinc-900 font-medium"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="Ativos">Pedidos Ativos</option>
              <option value="Histórico">Histórico (Entregues)</option>
              <option value="Todos">Todos os Pedidos</option>
              <option value="Pendente">Apenas Pendentes</option>
              <option value="Pago">Apenas Pagos</option>
              <option value="Em preparo">Em preparo</option>
              <option value="Saiu para entrega">Saiu para entrega</option>
              <option value="Entregue">Apenas Entregues</option>
            </select>
          </div>
        )}
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

                  {/* Address and Phone Block */}
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
                            {item.product_name}
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
                {profile?.role !== 'entregador' && (
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

                {profile?.role !== 'entregador' && (
                  <div className="flex items-center gap-1 ml-2 border-l border-zinc-100 pl-3">
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
    </div>
  );
}
