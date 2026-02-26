import { useState, useEffect, FormEvent } from 'react';
import { Users, Plus, Search, Phone, MapPin, History, Star, Pencil, Trash2, ShoppingBag, X, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { Customer, Order, Category } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Gás', emoji: '📦' },
  { id: 2, name: 'Água 20L', emoji: '💧' },
  { id: 3, name: 'Água de coco', emoji: '🥥' },
  { id: 4, name: 'Refrigerante', emoji: '🥤' }
];

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isConfirmEditOpen, setIsConfirmEditOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    notes: '',
    loyalty_count: 0
  });

  useEffect(() => {
    fetchCustomers();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const getEmoji = (catName: string) => {
    return categories.find(c => c.name === catName)?.emoji || '📦';
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setCustomers(data as Customer[]);
    } else if (error) {
      // Fallback in case the is_active column doesn't exist yet
      const { data: allData } = await supabase.from('customers').select('*').order('name');
      if (allData) setCustomers(allData as Customer[]);
    }
  };

  const fetchCustomerHistory = async (customerId: number) => {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (
            name,
            category
          )
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (data) setCustomerOrders(data as any[]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isEditMode) {
      setIsConfirmEditOpen(true);
    } else {
      const { error } = await supabase
        .from('customers')
        .insert([{
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          notes: formData.notes,
          loyalty_count: 0
        }]);

      if (!error) {
        setIsModalOpen(false);
        fetchCustomers();
        resetForm();
      }
    }
  };

  const confirmEdit = async () => {
    if (!selectedCustomer) return;
    const { error } = await supabase
      .from('customers')
      .update(formData)
      .eq('id', selectedCustomer.id);

    if (!error) {
      setIsConfirmEditOpen(false);
      setIsModalOpen(false);
      fetchCustomers();
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;
    console.log('Attempting to delete customer:', selectedCustomer.id);
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', selectedCustomer.id);

    if (error) {
      console.error('Delete error:', error);

      // If it's a foreign key constraint error (code 23503)
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        setIsDeleteModalOpen(false);
        setIsConflictModalOpen(true);
      } else {
        console.error('ERRO AO EXCLUIR:', error.message);
      }
    } else {
      console.log('Delete successful');
      setIsDeleteModalOpen(false);
      fetchCustomers();
    }
  };

  const handleRedeem = async () => {
    if (!selectedCustomer || selectedCustomer.loyalty_count < 10) return;
    setIsRedeeming(true);

    try {
      // 1. Subtract points
      const { error: updateError } = await supabase
        .from('customers')
        .update({ loyalty_count: selectedCustomer.loyalty_count - 10 })
        .eq('id', selectedCustomer.id);

      if (updateError) throw updateError;

      // 2. Register a $0 transaction
      await supabase.from('transactions').insert([{
        type: 'income',
        amount: 0,
        description: `Brinde Fidelidade - ${selectedCustomer.name}`
      }]);

      // 3. Subtract stock of a generic "Água 20L" if available
      const { data: waterProd } = await supabase
        .from('products')
        .select('*')
        .or('category.eq."Água 20L",name.ilike."%água 20l%"')
        .limit(1)
        .single();

      if (waterProd) {
        await supabase.from('products').update({
          stock_quantity: (waterProd.stock_quantity || 0) - 1
        }).eq('id', waterProd.id);

        await supabase.from('stock_movements').insert([{
          product_id: waterProd.id,
          type: 'out',
          quantity: 1,
          reason: `Brinde (Fidelidade: ${selectedCustomer.name})`
        }]);
      }

      setIsRedeemModalOpen(false);
      fetchCustomers();
    } catch (err) {
      console.error("Erro ao resgatar brinde:", err);
    } finally {
      setIsRedeeming(false);
    }
  };

  const forceDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    setIsDeleting(true);

    try {
      // 1. Get all orders for this customer
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', selectedCustomer.id);

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);

        // 2. Delete all order items
        await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds);

        // 3. Delete all orders
        await supabase
          .from('orders')
          .delete()
          .in('id', orderIds);
      }

      // 4. Finally delete the customer
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', selectedCustomer.id);

      if (error) throw error;

      setIsConflictModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      console.error('Force delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const archiveCustomer = async () => {
    if (!selectedCustomer) return;
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', selectedCustomer.id);

    if (!error) {
      setIsConflictModalOpen(false);
      fetchCustomers();
    } else {
      console.error('Erro ao arquivar:', error.message);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', phone: '', notes: '', loyalty_count: 0 });
    setIsEditMode(false);
    setSelectedCustomer(null);
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      address: customer.address || '',
      phone: customer.phone || '',
      notes: customer.notes || '',
      loyalty_count: customer.loyalty_count || 0
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const openHistoryModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchCustomerHistory(customer.id);
    setIsHistoryModalOpen(true);
  };

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-zinc-500">Gerencie sua base de clientes e fidelidade.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-3">
        <Search className="text-zinc-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          className="flex-1 bg-transparent border-none outline-none text-zinc-900"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <div
            key={customer.id}
            onClick={() => openHistoryModal(customer)}
            className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all group relative overflow-hidden"
          >
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform">
              <History size={120} />
            </div>

            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                {customer.name.charAt(0)}
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg" title="Fidelidade de Água">
                  <div className="text-sm">💧</div>
                  <span className="text-xs font-bold">{customer.loyalty_count}/10</span>
                </div>
                {customer.loyalty_count >= 10 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); setIsRedeemModalOpen(true); }}
                    className="mt-1 flex items-center gap-1 bg-emerald-600 text-white px-3 py-1 rounded-full hover:bg-emerald-700 transition-all shadow-sm"
                  >
                    <Star size={12} fill="currentColor" />
                    <span className="text-[10px] font-bold uppercase">Entregar Brinde</span>
                  </button>
                )}
              </div>
            </div>

            <h3 className="text-lg font-bold text-zinc-900 mb-1 relative z-10">{customer.name}</h3>

            <div className="space-y-2 mt-4 relative z-10">
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Phone size={14} />
                <span>{customer.phone || 'Sem telefone'}</span>
              </div>
              <div className="flex items-start gap-2 text-zinc-500 text-sm">
                <MapPin size={14} className="mt-1 flex-shrink-0" />
                <span className="line-clamp-2">{customer.address || 'Sem endereço'}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(customer); }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); setIsDeleteModalOpen(true); }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex-1 bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min((customer.loyalty_count / 10) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New/Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6">{isEditMode ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Nome Completo</label>
                <input
                  required
                  type="text"
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Telefone</label>
                <input
                  required
                  type="tel"
                  placeholder="(00) 00000-0000"
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Endereço</label>
                <textarea
                  rows={2}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Observações</label>
                <textarea
                  rows={2}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              {isEditMode && (
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Contagem de Fidelidade (Ganhos com Água 20L)</label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-700"
                    value={formData.loyalty_count}
                    onChange={e => setFormData({ ...formData, loyalty_count: parseInt(e.target.value) })}
                  />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold">Histórico de Pedidos</h3>
                <p className="text-zinc-500 text-sm">{selectedCustomer?.name}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {customerOrders.length > 0 ? (
                customerOrders.map(order => (
                  <div key={order.id} className="border border-zinc-100 rounded-[2rem] bg-zinc-50 overflow-hidden transition-all">
                    <button
                      onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      className="w-full p-5 flex items-center justify-between hover:bg-zinc-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${order.payment_status === 'Pago' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          <ShoppingBag size={20} />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900">Pedido #{order.id}</span>
                            <span className="text-[10px] text-zinc-500 font-medium">• {new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <p className="text-xs text-zinc-500">{order.payment_method} • {order.delivery_status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-black text-emerald-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}</p>
                          <span className={`text-[10px] font-bold uppercase ${order.payment_status === 'Pago' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {order.payment_status}
                          </span>
                        </div>
                        {String(expandedOrderId) === String(order.id) ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                      </div>
                    </button>

                    {String(expandedOrderId) === String(order.id) && (
                      <div className="px-5 pb-5 pt-2 border-t border-zinc-200/50 bg-white/50 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Itens do Pedido</p>
                          {(order as any).order_items && (order as any).order_items.length > 0 ? (
                            (order as any).order_items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-sm p-4 bg-white rounded-2xl border border-zinc-100/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-center">
                                    <span className="w-10 h-10 flex items-center justify-center bg-zinc-100 rounded-xl text-xs font-black text-zinc-600">
                                      {item.quantity}x
                                    </span>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs">{getEmoji(item.product?.category)}</span>
                                      <span className="font-bold text-zinc-800">{item.product?.name || 'Produto não encontrado'}</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                                      {item.product?.category || 'Sem Categoria'} • R$ {item.price_at_time.toFixed(2)} un.
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-black text-emerald-600 block">R$ {(item.price_at_time * item.quantity).toFixed(2)}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-400 italic py-2">Nenhum item registrado para este pedido.</p>
                          )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase">
                          <span>Status: {order.delivery_status}</span>
                          <span className="text-emerald-500">Pagamento: {order.payment_status}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-zinc-400">Nenhum pedido encontrado.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Excluir Cliente</h3>
            <p className="text-zinc-500 text-sm mb-6">
              Tem certeza que deseja excluir <strong>{selectedCustomer?.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict / Choice Modal */}
      {isConflictModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl border border-red-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert size={32} />
            </div>

            <h3 className="text-2xl font-black text-center text-zinc-900 mb-2">Conflito de Dados</h3>
            <p className="text-zinc-500 text-center mb-8">
              O cliente <strong>{selectedCustomer?.name}</strong> possui pedidos registrados. O que deseja fazer?
            </p>

            <div className="space-y-3">
              <button
                onClick={archiveCustomer}
                className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group"
              >
                <div className="text-left flex-1 px-4">
                  <div className="text-sm">Arquivar Cliente</div>
                  <div className="text-[10px] text-zinc-400 font-normal">Apenas oculta da lista (Recomendado)</div>
                </div>
                <div className="bg-white/10 p-2 rounded-lg group-hover:scale-110 transition-transform">
                  <History size={18} />
                </div>
              </button>

              <button
                disabled={isDeleting}
                onClick={forceDeleteCustomer}
                className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                <div className="text-left flex-1 px-4">
                  <div className="text-sm">{isDeleting ? 'Excluindo...' : 'Excluir TUDO'}</div>
                  <div className="text-[10px] text-red-400 font-normal">Apaga permanentemente cliente e pedidos</div>
                </div>
                <div className="bg-red-200/50 p-2 rounded-lg group-hover:scale-110 transition-transform">
                  <Trash2 size={18} />
                </div>
              </button>

              <button
                onClick={() => setIsConflictModalOpen(false)}
                className="w-full py-4 text-zinc-400 font-bold hover:text-zinc-600 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirmation Modal */}
      {isConfirmEditOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-blue-600">Confirmar Alterações</h3>
            <p className="text-zinc-500 text-sm mb-6">
              Você tem certeza que deseja salvar as alterações nos dados de <strong>{selectedCustomer?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmEditOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all">Revisar</button>
              <button onClick={confirmEdit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">Sim, Salvar</button>
            </div>
          </div>
        </div>
      )}
      {/* Redemption Confirmation Modal */}
      {isRedeemModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl border border-emerald-100 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <Star size={32} fill="currentColor" />
            </div>
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Entregar Brinde?</h3>
            <p className="text-zinc-500 text-sm mb-8">
              Confirma a entrega de uma **Água 20L** grátis para <strong>{selectedCustomer?.name}</strong>?
              <br /><br />
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                -10 pontos da fidelidade
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <button
                disabled={isRedeeming}
                onClick={handleRedeem}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
              >
                {isRedeeming ? 'Processando...' : 'Confirmar Entrega'}
              </button>
              <button
                onClick={() => setIsRedeemModalOpen(false)}
                className="w-full py-2 text-zinc-400 font-bold hover:text-zinc-600 transition-all"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
