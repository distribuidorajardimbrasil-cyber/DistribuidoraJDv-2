import { useState, useEffect, FormEvent } from 'react';
import { DollarSign, TrendingUp, TrendingDown, History, Plus, Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, Trash2, ShieldAlert, Info, X, ShoppingBag, User, BarChart2, Filter } from 'lucide-react';
import { Transaction, Category } from '../types';
import { supabase } from '../lib/supabase';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

type Period = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function Finance() {
  const [stats, setStats] = useState({
    periodTotal: 0,
    periodExpenses: 0,
    profit: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: 0,
    description: '',
    category: 'all'
  });
  const [selectedTxForDetails, setSelectedTxForDetails] = useState<Transaction | null>(null);
  const [linkedOrderItems, setLinkedOrderItems] = useState<any[]>([]);
  const [linkedOrderCustomerName, setLinkedOrderCustomerName] = useState<string>('');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Filters
  const [period, setPeriod] = useState<Period>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data as Category[]);
  };

  useEffect(() => {
    fetchData();
  }, [period, selectedDate, filterCategory]);

  const getDateRange = () => {
    const date = parseISO(selectedDate);
    switch (period) {
      case 'daily':
        return { start: startOfDay(date), end: endOfDay(date) };
      case 'weekly':
        return { start: startOfWeek(date, { locale: ptBR }), end: endOfWeek(date, { locale: ptBR }) };
      case 'monthly':
      default:
        return { start: startOfMonth(date), end: endOfMonth(date) };
    }
  };

  const fetchData = async () => {
    const { start, end } = getDateRange();
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    let finalTransactions: Transaction[] = [];
    let periodTotal = 0;
    let periodExpenses = 0;
    let profitTotal = 0;

    const chartMap = new Map<string, { name: string; Entradas: number; Saídas: number }>();

    // Initialize chart
    if (period === 'monthly' || period === 'weekly') {
      let current = new Date(start);
      while (current <= end) {
        const key = format(current, 'dd/MM');
        chartMap.set(key, { name: key, Entradas: 0, Saídas: 0 });
        current.setDate(current.getDate() + 1);
      }
    } else {
      for (let i = 8; i <= 20; i++) {
        const key = `${i.toString().padStart(2, '0')}:00`;
        chartMap.set(key, { name: key, Entradas: 0, Saídas: 0 });
      }
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_at, payment_status, total_amount')
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    const { data: trans } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .order('created_at', { ascending: false });

    // Helper to add to chart
    const addToChart = (dateStr: string, type: 'income' | 'expense', amount: number) => {
      const tDate = parseISO(dateStr);
      let key = period === 'daily' ? `${tDate.getHours().toString().padStart(2, '0')}:00` : format(tDate, 'dd/MM');
      if (chartMap.has(key)) {
        if (type === 'income') chartMap.get(key)!.Entradas += amount;
        else chartMap.get(key)!.Saídas += amount;
      }
    };

    if (filterCategory === 'all') {
      // General view
      if (trans) {
        finalTransactions = trans as Transaction[];
        for (const t of trans) {
          if (t.type === 'income') periodTotal += t.amount;
          else periodExpenses += t.amount;
          addToChart(t.created_at, t.type as any, t.amount);
        }
      }

      if (orders && orders.length > 0) {
        const orderIds = orders.filter(o => o.payment_status === 'Pago').map(o => o.id);
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, quantity, price_at_time')
          .in('order_id', orderIds);

        if (items) {
          const productIds = [...new Set(items.map(i => i.product_id))];
          const { data: prods } = await supabase.from('products').select('id, price_cost').in('id', productIds);
          if (prods) {
            const costMap = Object.fromEntries(prods.map(p => [p.id, p.price_cost]));
            for (const item of items) {
              const cost = costMap[item.product_id!] || 0;
              profitTotal += (Number(item.price_at_time) - Number(cost)) * item.quantity;
            }
          }
        }
      }
    } else {
      // Category Specific View
      // 1. Filter orders matching category items
      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, product_id, quantity, price_at_time, product:products(category, price_cost)')
          .in('order_id', orderIds)
          .eq('product.category', filterCategory); // Assuming Supabase joins can filter like this, we'll process in mem to be safe

        const { data: allItems } = await supabase
          .from('order_items')
          .select('*, product:products!inner(category, price_cost)')
          .in('order_id', orderIds)
          .eq('product.category', filterCategory);

        if (allItems) {
          // Process income from these specific items
          const orderIncomeMap = new Map<number, number>(); // order_id -> category_income

          for (const item of allItems) {
            const order = orders.find(o => o.id === item.order_id);
            if (order && order.payment_status === 'Pago') {
              const revenue = Number(item.price_at_time) * item.quantity;
              const cost = Number((item.product as any).price_cost || 0) * item.quantity;

              periodTotal += revenue;
              profitTotal += (revenue - cost);

              orderIncomeMap.set(item.order_id!, (orderIncomeMap.get(item.order_id!) || 0) + revenue);
            }
          }

          // Generate synthetic transactions for the list based on specific item chunks
          orderIncomeMap.forEach((revenue, id) => {
            const order = orders.find(o => o.id === id);
            if (order) {
              finalTransactions.push({
                id: -id, // negative ID to indicate partial synthetic transaction
                type: 'income',
                amount: revenue,
                description: `Receita ${filterCategory} (Pedido #${id})`,
                created_at: order.created_at
              });
              addToChart(order.created_at, 'income', revenue);
            }
          });
        }
      }

      // 2. Filter expenses matching category label in description (e.g. "[Gás] Compra...")
      if (trans) {
        for (const t of trans) {
          if (t.type === 'expense' && t.description.includes(`[${filterCategory}]`)) {
            finalTransactions.push(t as Transaction);
            periodExpenses += t.amount;
            addToChart(t.created_at, 'expense', t.amount);
          }
        }
      }

      finalTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setTransactions(finalTransactions);
    setChartData(Array.from(chartMap.values()));
    setStats({ periodTotal, periodExpenses, profit: profitTotal });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const finalDescription = formData.category !== 'all' && formData.type === 'expense'
      ? `[${formData.category}] ${formData.description}`
      : formData.description;

    const { error } = await supabase.from('transactions').insert([{
      type: formData.type,
      amount: formData.amount,
      description: finalDescription
    }]);

    if (!error) {
      setIsModalOpen(false);
      fetchData();
      setFormData({ type: 'expense', amount: 0, description: '', category: 'all' });
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return;
    setIsDeleting(true);
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', selectedTransaction.id);

    if (!error) {
      setIsDeleteModalOpen(false);
      fetchData();
    }
    setIsDeleting(false);
  };

  const fetchTransactionDetails = async (tx: Transaction) => {
    setSelectedTxForDetails(tx);
    setLinkedOrderItems([]);
    setLinkedOrderCustomerName('');

    const orderIdMatch = tx.description.match(/Pedido #(\d+)/);
    if (orderIdMatch) {
      setIsLoadingDetails(true);
      const orderId = parseInt(orderIdMatch[1]);

      const { data: orderData } = await supabase
        .from('orders')
        .select('*, customer:customers(name), order_items(*, product:products(name, category))')
        .eq('id', orderId)
        .single();

      if (orderData) {
        setLinkedOrderItems(orderData.order_items || []);
        setLinkedOrderCustomerName(orderData.customer?.name || 'Cliente não identificado');
      }
      setIsLoadingDetails(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-zinc-200 rounded-xl shadow-lg">
          <p className="font-bold text-zinc-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Financeiro</h2>
          <p className="text-zinc-500">Controle de entradas, saídas e relatórios.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-black transition-all flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Nova Despesa
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
        <div className="flex flex-wrap items-center bg-zinc-100 p-1 rounded-xl">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${period === p ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
            >
              {p === 'daily' ? 'Diário' : p === 'weekly' ? 'Semanal' : 'Mensal'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 p-2 px-3 rounded-xl">
            <Filter size={18} className="text-zinc-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-emerald-700 cursor-pointer text-sm"
            >
              <option value="all">Resumo (Geral)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 p-2 px-4 rounded-xl">
            <CalendarIcon size={20} className="text-zinc-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-zinc-700 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <TrendingUp size={20} />
          </div>
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Entradas ({period === 'daily' ? 'Dia' : period === 'weekly' ? 'Semana' : 'Mês'})</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(stats.periodTotal)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
            <TrendingDown size={20} />
          </div>
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Saídas ({period === 'daily' ? 'Dia' : period === 'weekly' ? 'Semana' : 'Mês'})</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(stats.periodExpenses)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <DollarSign size={20} />
          </div>
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Lucro Bruto (Estimado)</p>
          <p className="text-2xl font-bold mt-1 text-indigo-600">{formatCurrency(stats.profit)}</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={20} className="text-zinc-400" />
          <h3 className="font-bold text-lg">Resumo Financeiro</h3>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} tickFormatter={(value) => `R$ ${value}`} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F4F4F5' }} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="Entradas" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Saídas" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions History */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <History size={20} className="text-zinc-400" />
            Movimentações do Período
          </h3>
        </div>
        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-zinc-500 font-medium">
              Nenhuma movimentação encontrada para o período selecionado.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Valor</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {new Date(tx.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td
                      className="px-6 py-4 font-medium text-zinc-900 cursor-pointer hover:text-emerald-600 flex items-center gap-2 group"
                      onClick={() => fetchTransactionDetails(tx)}
                    >
                      {tx.description}
                      {tx.description.includes('Pedido #') && <Info size={14} className="text-zinc-300 group-hover:text-emerald-400" />}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {tx.type === 'income' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {tx.type === 'income' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => { setSelectedTransaction(tx); setIsDeleteModalOpen(true); }}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Registrar Movimentação</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income' })}
                    className={`py-3 rounded-xl font-bold transition-all ${formData.type === 'income' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-500'
                      }`}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                    className={`py-3 rounded-xl font-bold transition-all ${formData.type === 'expense' ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-500'
                      }`}
                  >
                    Saída
                  </button>
                </div>
              </div>
              {formData.type === 'expense' && (
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Categoria (Opcional)</label>
                  <select
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-zinc-500"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="all">Despesa Geral</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Valor</label>
                <input
                  required
                  type="number" step="0.01"
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-zinc-500"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Descrição</label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Pagamento de luz, Compra de estoque..."
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-zinc-500"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-black shadow-lg shadow-zinc-100 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl border border-red-100 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Excluir Registro?</h3>
            <p className="text-zinc-500 text-sm mb-8">
              Esta ação removerá permanentemente a movimentação <strong>"{selectedTransaction?.description}"</strong> e atualizará seus saldos.
            </p>
            <div className="flex flex-col gap-3">
              <button
                disabled={isDeleting}
                onClick={handleDeleteTransaction}
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

      {/* Transaction Details Modal */}
      {selectedTxForDetails && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold">Detalhes da Movimentação</h3>
                <p className="text-zinc-500 text-sm">{new Date(selectedTxForDetails.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => setSelectedTxForDetails(null)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex flex-col items-center text-center">
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${selectedTxForDetails.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {selectedTxForDetails.type === 'income' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                </span>
                <p className="text-sm text-zinc-500 font-medium uppercase tracking-wider">{selectedTxForDetails.description}</p>
                <p className={`text-3xl font-black mt-1 ${selectedTxForDetails.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedTxForDetails.type === 'income' ? '+' : '-'} {formatCurrency(selectedTxForDetails.amount)}
                </p>
              </div>

              {isLoadingDetails ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
              ) : linkedOrderItems.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center gap-3">
                    <User size={18} className="text-zinc-500" />
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cliente</p>
                      <p className="font-bold text-zinc-800">{linkedOrderCustomerName}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag size={16} className="text-zinc-400" />
                      <h4 className="font-bold text-zinc-900">Produtos do Pedido</h4>
                    </div>
                    {linkedOrderItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm p-4 bg-white border border-zinc-100 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 flex items-center justify-center bg-zinc-100 rounded-lg text-xs font-bold text-zinc-500">
                            {item.quantity}x
                          </span>
                          <span className="font-bold text-zinc-800">{item.product?.name}</span>
                        </div>
                        <span className="font-medium text-emerald-600">R$ {(item.price_at_time * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedTxForDetails.description.includes('Pedido #') ? (
                <p className="text-center text-zinc-400 text-sm py-4 italic">Pedido não encontrado ou sem itens registrados.</p>
              ) : null}
            </div>

            <div className="mt-8">
              <button
                onClick={() => setSelectedTxForDetails(null)}
                className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-black transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
