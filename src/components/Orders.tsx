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
  const [editManualTotal, setEditManualTotal] = useState<number>(0);
  const [deliverymen, setDeliverymen] = useState<Profile[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchCategories();
    fetchProducts();
    fetchDeliverymen();

    const channel = supabase.channel('orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders(); // auto-refresh
        if (profile?.role === 'entregador') {
          const isNewAssignment = 
            (payload.eventType === 'INSERT' && payload.new.deliveryman_id === profile.id) ||
            (payload.eventType === 'UPDATE' && payload.new.deliveryman_id === profile.id && payload.old?.deliveryman_id !== profile.id);
            
          if (isNewAssignment) {
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
            try {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContext) {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
              }
            } catch(e){}
            
            if (Notification.permission === 'granted') {
              new Notification('Novo Pedido!', { body: `Você recebeu o Pedido #${payload.new.id}` });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(p => {
                if (p === 'granted') new Notification('Novo Pedido!', { body: `Você recebeu o Pedido #${payload.new.id}` });
              });
            }
          }
        }
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchDeliverymen = async () => {
    const { data } = await supabase.from('profiles').select('id, name, role').eq('role', 'entregador');
    if (data) setDeliverymen(data as Profile[]);
  };

  const updateDeliveryman = async (id: number, deliverymanId: string | null) => {
    const { error } = await supabase.from('orders').update({ deliveryman_id: deliverymanId }).eq('id', id);
    if (!error) fetchOrders();
  };

  const handleUpdateManualLink = async (customerId: number) => {
    const link = prompt("Cole o link do Google Maps para este cliente:");
    if (!link) return;
    try {
      const { error } = await supabase.rpc('update_customer_map_link', { p_customer_id: customerId, p_link: link });
      if (error) alert("Erro ao salvar link: " + error.message);
      else fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

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
      .select('*, customer:customers(name, address, phone, notes, google_maps_link, customer_locations(latitude, longitude, created_at)), items:order_items(id, product_id, quantity, price_at_time, product:products(name, category, price_sell, stock_quantity))')
      .order('created_at', { ascending: false });

    if (data) {
      const formattedData = data.map((o: any) => {
        // Find latest unique location (just 1)
        let latestLocation = null;
        if (o.customer?.customer_locations?.length > 0) {
          const locs = o.customer.customer_locations.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          latestLocation = locs[0];
        }

        return {
          ...o,
          customer_name: o.customer?.name || null,
          customer_address: o.customer?.address || null,
          customer_phone: o.customer?.phone || null,
          customer_notes: o.customer?.notes || null,
          customer_google_maps_link: o.customer?.google_maps_link || null,
          customer_location: latestLocation,
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
        };
      });
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
        const netAmt = order.net_amount !== null && order.net_amount !== undefined ? order.net_amount : order.total_amount;
        await supabase.from('transactions').insert([{
          type: 'income',
          amount: netAmt,
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
      
      if (value === 'Entregue' && order.customer_id) {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { error: insertError } = await supabase.from('customer_locations').insert([{
                  customer_id: order.customer_id,
                  order_id: order.id,
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                }]);
                if (insertError) {
                  alert("Erro no DB ao salvar GPS: " + insertError.message);
                }
              } catch (e: any) {
                console.error("Erro ao salvar localização:", e);
              }
            },
            (error) => {
              console.warn("Não foi possível capturar a localização:", error.message);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: Infinity }
          );
        }
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
    
    setEditManualTotal(order.total_amount);
    
    setEditNotes(order.notes || '');
    setProductSearch('');
    setIsEditModalOpen(true);
  };

  const saveEditOrder = async () => {
    if (!editingOrder || editCart.length === 0) return;
    setIsSavingEdit(true);

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
      // Fix net_amount calculation if it's Maquineta
      let netAmount = editManualTotal;
      if (editingOrder.payment_method?.startsWith('Maquineta')) {
         // rough fix: keep the same percentage discount as before
         const oldRatio = editingOrder.total_amount > 0 ? (editingOrder.net_amount || editingOrder.total_amount) / editingOrder.total_amount : 1;
         netAmount = editManualTotal * oldRatio;
      }
      await supabase.from('orders').update({ total_amount: editManualTotal, net_amount: netAmount, notes: editNotes }).eq('id', editingOrder.id);

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
      if (o.deliveryman_id !== profile.id) return false;

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
          <p className="text-zinc-500 dark:text-zinc-400">{isFinanceMode ? 'Gerencie pendências e pagamentos de pedidos.' : 'Acompanhe e gerencie as entregas.'}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none flex items-center gap-3">
          <Search className="text-zinc-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente ou Nº do pedido..."
            className="flex-1 bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none flex items-center gap-3">
          <Filter className="text-zinc-400" size={20} />
          <select
            className="bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-50 font-medium"
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
          <div key={order.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover:shadow-md dark:shadow-none transition-all">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                  <ShoppingCart size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <h3 className="font-bold text-lg leading-tight">Pedido #{order.id}</h3>
                    <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">• {new Date(order.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 font-medium break-words">{order.customer_name || 'Consumidor Final'}</p>

                  {(order.customer_address || order.customer_phone || order.customer_google_maps_link || order.customer_location || order.customer_id) && (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 flex flex-col gap-2">
                      {order.customer_address && <span>📍 {order.customer_address}</span>}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.customer_phone && (
                          <a
                            href={`https://wa.me/55${order.customer_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium text-xs flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800"
                            title="Chamar no WhatsApp"
                            onClick={(e) => e.stopPropagation()}
                          >
                            📱 WhatsApp
                          </a>
                        )}
                        {order.customer_google_maps_link ? (
                          <a
                            href={order.customer_google_maps_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold text-xs flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800"
                            title="Abrir no Google Maps"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🗺️ Rota (Manual)
                          </a>
                        ) : order.customer_location ? (
                          <a
                            href={`https://www.google.com/maps?q=${order.customer_location.latitude},${order.customer_location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold text-xs flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800"
                            title="Abrir MAPS"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🗺️ MAPS
                          </a>
                        ) : null}


                      </div>
                    </div>
                  )}

                  {/* Customer Notes */}
                  {order.customer_notes && (
                    <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-800 text-xs p-2 rounded-lg inline-block">
                      <strong>Obs. Cliente:</strong> {order.customer_notes}
                    </div>
                  )}

                  {/* Order Notes */}
                  {order.notes && (
                    <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 text-blue-800 text-xs p-2 rounded-lg inline-block md:ml-2">
                      <strong>Obs. Pedido:</strong> {order.notes}
                    </div>
                  )}

                  {/* Items List */}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/50 overflow-hidden">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Itens do Pedido</p>
                      <ul className="space-y-1">
                        {order.items.map(item => (
                          <li key={item.id} className="text-sm text-zinc-700 dark:text-zinc-300 flex items-start gap-2 min-w-0">
                            <span className="font-bold text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-xs shrink-0 mt-0.5">
                              {item.quantity}x
                            </span>
                            <span className="flex-1 break-words leading-tight pt-0.5">
                              {item.product_category ? `${item.product_category} ${item.product_name}` : item.product_name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {profile?.role !== 'entregador' && (
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg mt-3">{formatCurrency(order.total_amount)} <span className="text-xs text-zinc-400 font-normal">({order.payment_method})</span></p>
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
                      className={`text-xs font-bold px-3 py-2 rounded-xl outline-none border-none cursor-pointer ${order.payment_status === 'Pago' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                        }`}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Pago">Pago</option>
                    </select>
                  </div>
                )}

                {(!isFinanceMode) && (
                  <div className="flex gap-2 items-center">
                    {profile?.role !== 'entregador' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Entregador</label>
                        <select
                          value={order.deliveryman_id || ''}
                          onChange={(e) => updateDeliveryman(order.id, e.target.value || null)}
                          className={`text-xs font-bold px-3 py-2 rounded-xl outline-none border-none cursor-pointer ${order.deliveryman_id ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'}`}
                        >
                          <option value="">Não atribuído</option>
                          {deliverymen.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Entrega</label>
                      <select
                        value={order.delivery_status}
                        onChange={(e) => updateStatus(order.id, 'delivery', e.target.value)}
                        className={`text-xs font-bold px-3 py-2 rounded-xl outline-none border-none cursor-pointer ${order.delivery_status === 'Entregue' ? 'bg-blue-100 text-blue-700' :
                          order.delivery_status === 'Saiu para entrega' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                          }`}
                      >
                        <option value="Em preparo">Em preparo</option>
                        <option value="Saiu para entrega">Saiu para entrega</option>
                        <option value="Entregue">Entregue</option>
                      </select>
                    </div>
                  </div>
                )}

                {profile?.role !== 'entregador' && (
                  <div className="flex items-center gap-1 ml-2 border-l border-zinc-100 dark:border-zinc-800/50 pl-3">
                    {order.payment_status === 'Pendente' && (
                      <button
                        onClick={() => openEditModal(order)}
                        className="p-2 text-zinc-400 hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-900/20 rounded-xl transition-all"
                        title="Editar Pedido"
                      >
                        <Edit2 size={20} />
                      </button>
                    )}
                    {!isFinanceMode && (
                      <button
                        onClick={() => { setSelectedOrder(order); setIsDeleteModalOpen(true); }}
                        className="p-2 text-zinc-400 hover:text-red-500 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-xl transition-all"
                        title="Excluir Pedido"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800/50">
            <ShoppingCart size={48} className="mx-auto text-zinc-200 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Nenhum pedido encontrado.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-sm:p-6 max-w-sm p-8 shadow-2xl dark:shadow-none border border-red-100 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-2">Excluir Pedido?</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
              Confirma a exclusão permanente do <strong>Pedido #{selectedOrder?.id}</strong>?
              <br /><br />
              <span className="text-red-600 dark:text-red-400 text-[10px] font-bold uppercase">
                ⚠️ Aviso: Estoque e pontos já processados não serão revertidos automaticamente.
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <button
                disabled={isDeleting}
                onClick={handleDeleteOrder}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-lg dark:shadow-none shadow-red-100 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-2 text-zinc-400 font-bold hover:text-zinc-600 dark:text-zinc-400 transition-all"
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
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl dark:shadow-none overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Edit2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                  Editar Pedido #{editingOrder?.id}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">{editingOrder?.customer_name || 'Consumidor Final'}</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Product Selection */}
              <div>
                <h4 className="font-bold mb-4 text-zinc-800 dark:text-zinc-200">Adicionar Produtos</h4>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar produto..."
                    className="w-full pl-10 pr-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500 text-sm"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(product => (
                    <button
                      key={product.id}
                      onClick={() => addToEditCart(product)}
                      className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/50 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 dark:bg-emerald-900/20 transition-colors text-left"
                    >
                      <div>
                        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{product.name}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">{product.category}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">R$ {product.price_sell.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Cart */}
              <div className="flex flex-col">
                <h4 className="font-bold mb-4 text-zinc-800 dark:text-zinc-200">Itens Atuais do Pedido</h4>
                <div className="flex-1 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {editCart.map(item => (
                    <div key={item.product.id} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{item.product.name}</p>
                        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1">
                          <button onClick={() => removeFromEditCart(item.product.id)} className="p-1 hover:bg-zinc-100 dark:bg-zinc-800/50 rounded-md text-zinc-500 dark:text-zinc-400"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                          <button onClick={() => addToEditCart(item.product)} className="p-1 hover:bg-zinc-100 dark:bg-zinc-800/50 rounded-md text-emerald-600 dark:text-emerald-400"><Plus size={14} /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">Unidade: R$</span>
                        <input
                          type="number" step="0.01"
                          className="w-20 px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:border-emerald-500 font-bold text-emerald-700 dark:text-emerald-400"
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
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500 text-sm resize-none"
                    placeholder="Ex: Troco para 50, entregar na portaria..."
                    rows={2}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between items-center mb-4 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-zinc-600 dark:text-zinc-400 uppercase text-xs">Valor Total Final (R$)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-32 px-3 py-2 text-lg bg-white dark:bg-zinc-900 border border-emerald-300 rounded-lg outline-none focus:border-emerald-600 font-black text-emerald-700 dark:text-emerald-400 text-right"
                      value={editManualTotal}
                      onChange={e => setEditManualTotal(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 font-bold rounded-xl hover:bg-zinc-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveEditOrder}
                      disabled={editCart.length === 0 || isSavingEdit}
                      className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg dark:shadow-none shadow-emerald-100 transition-all disabled:opacity-50"
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
