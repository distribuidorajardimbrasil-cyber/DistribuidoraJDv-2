import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  DollarSign,
  ShoppingBag,
  Package,
  Users,
  Truck,
  CheckSquare,
  Square,
  Filter,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function Reports() {
  const { products, categories, deliverymen } = useData();
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'last_month' | 'custom'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Checkboxes for sections
  const [sections, setSections] = useState({
    finance: true,
    orders: true,
    stock: true,
    customers: true,
    delivery: true,
  });

  // Loaded data for report
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<any[]>([]);

  // Initialize dates on mount
  useEffect(() => {
    updateDateRange('month');
  }, []);

  const updateDateRange = (type: 'today' | '7days' | 'month' | 'last_month' | 'custom') => {
    setPeriod(type);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (type === '7days') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (type === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    if (type !== 'custom') {
      const formatYMD = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(end));
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReportData();
    }
  }, [startDate, endDate]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const startIso = new Date(`${startDate}T00:00:00`).toISOString();
      const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

      // 1. Fetch Orders in period
      const { data: ordersRes } = await supabase
        .from('orders')
        .select(`
          id, customer_id, total_amount, net_amount, payment_method, payment_status, delivery_status, deliveryman_id, notes, created_at,
          customer:customers(name, phone, address),
          items:order_items(id, product_id, quantity, price_at_time, product:products(name, category, price_cost, price_sell))
        `)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false });

      // 2. Fetch Transactions in period
      const { data: transRes } = await supabase
        .from('transactions')
        .select('id, type, amount, description, created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false });

      // 3. Fetch Top Customers
      const { data: custRes } = await supabase
        .from('customers')
        .select('id, name, phone, address, loyalty_count')
        .order('loyalty_count', { ascending: false })
        .limit(20);

      if (ordersRes) setOrders(ordersRes);
      if (transRes) setTransactions(transRes);
      if (custRes) setCustomersData(custRes);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculations
  const totalRevenue = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const netProfit = totalRevenue - totalExpenses;

  const totalOrdersCount = orders.length;
  const paidOrdersCount = orders.filter(o => o.payment_status === 'Pago').length;
  const pendingOrdersCount = orders.filter(o => o.payment_status === 'Pendente').length;
  const deliveredOrdersCount = orders.filter(o => o.delivery_status === 'Entregue').length;
  const avgTicket = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount) : 0;

  // Payment methods breakdown
  const paymentMethodsMap: Record<string, number> = {};
  orders.forEach(o => {
    const method = o.payment_method || 'Outro';
    paymentMethodsMap[method] = (paymentMethodsMap[method] || 0) + Number(o.total_amount || 0);
  });
  const paymentMethodsChartData = Object.entries(paymentMethodsMap).map(([name, value]) => ({
    name,
    value
  }));

  // Top Selling Products in period
  const productsMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach(o => {
    o.items?.forEach((it: any) => {
      const pName = it.product?.name || `Produto #${it.product_id}`;
      if (!productsMap[pName]) {
        productsMap[pName] = { name: pName, qty: 0, revenue: 0 };
      }
      productsMap[pName].qty += Number(it.quantity || 0);
      productsMap[pName].revenue += Number(it.quantity || 0) * Number(it.price_at_time || 0);
    });
  });
  const topProducts = Object.values(productsMap).sort((a, b) => b.qty - a.qty);

  // Deliverymen performance
  const deliverymanMap: Record<string, { name: string; count: number; total: number }> = {};
  orders.forEach(o => {
    if (o.deliveryman_id) {
      const dman = deliverymen.find(d => d.id === o.deliveryman_id);
      const dName = dman?.name || 'Entregador';
      if (!deliverymanMap[o.deliveryman_id]) {
        deliverymanMap[o.deliveryman_id] = { name: dName, count: 0, total: 0 };
      }
      deliverymanMap[o.deliveryman_id].count += 1;
      deliverymanMap[o.deliveryman_id].total += Number(o.total_amount || 0);
    }
  });
  const deliveryStats = Object.values(deliverymanMap);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6'];

  return (
    <div className="space-y-8 pb-12 print:p-0 print:m-0 print:space-y-4">
      {/* Header - Screen only */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="text-emerald-600 dark:text-emerald-400" size={28} />
            Relatórios & Exportação de Dados
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Gere relatórios analíticos em PDF prontos para impressão ou arquivamento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadReportData}
            disabled={loading}
            className="p-2.5 text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Atualizar Dados"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Printer size={18} />
            Baixar / Imprimir PDF
          </button>
        </div>
      </div>

      {/* Printable Corporate Header (Visible ONLY on print) */}
      <div className="hidden print:block border-b-2 border-emerald-600 pb-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">DISTRIBUIDORA JARDIM BRASIL</h1>
            <p className="text-xs text-zinc-600 font-semibold">Relatório Gerencial de Operação e Desempenho</p>
          </div>
          <div className="text-right text-xs text-zinc-500 space-y-0.5">
            <p><strong>Período:</strong> {startDate} até {endDate}</p>
            <p><strong>Emissão:</strong> {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Control Filters & Section Checkboxes - Screen only */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 print:hidden">
        {/* Period Selector */}
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-3 flex items-center gap-2">
            <Calendar size={14} /> Selecionar Período do Relatório
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'today', label: 'Hoje' },
              { id: '7days', label: 'Últimos 7 Dias' },
              { id: 'month', label: 'Este Mês' },
              { id: 'last_month', label: 'Mês Passado' },
              { id: 'custom', label: 'Personalizado' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => updateDateRange(p.id as any)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section Checkboxes */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-3 flex items-center gap-2">
            <Filter size={14} /> Caixas de Dados a Incluir no PDF
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { key: 'finance', label: 'Financeiro & Lucro', icon: DollarSign },
              { key: 'orders', label: 'Vendas & Pedidos', icon: ShoppingBag },
              { key: 'stock', label: 'Estoque & Produtos', icon: Package },
              { key: 'customers', label: 'Clientes & Fidelidade', icon: Users },
              { key: 'delivery', label: 'Entregadores', icon: Truck },
            ].map(sec => {
              const Icon = sec.icon;
              const isChecked = sections[sec.key as keyof typeof sections];
              return (
                <button
                  key={sec.key}
                  onClick={() => toggleSection(sec.key as keyof typeof sections)}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border text-sm font-semibold transition-all text-left cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-400'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Square size={18} className="text-zinc-400 flex-shrink-0" />
                  )}
                  <Icon size={16} />
                  <span className="truncate">{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 print:border print:border-zinc-300">
          <p className="text-xs font-bold text-zinc-400 uppercase">Faturamento Bruto</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">{paidOrdersCount} pedidos pagos</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 print:border print:border-zinc-300">
          <p className="text-xs font-bold text-zinc-400 uppercase">Despesas do Período</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">Gastos operacionais</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 print:border print:border-zinc-300">
          <p className="text-xs font-bold text-zinc-400 uppercase">Lucro Líquido</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {formatCurrency(netProfit)}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">Receitas menos despesas</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 print:border print:border-zinc-300">
          <p className="text-xs font-bold text-zinc-400 uppercase">Volume de Pedidos</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {totalOrdersCount}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">Ticket Médio: {formatCurrency(avgTicket)}</p>
        </div>
      </div>

      {/* SECTION 1: Finance & Payment Methods */}
      {sections.finance && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm print:shadow-none print:border print:border-zinc-300 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <DollarSign className="text-emerald-600" size={20} />
            Detalhamento Financeiro & Meios de Pagamento
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <p className="text-xs font-bold text-zinc-400 uppercase">Receita por Forma de Pagamento</p>
              <div className="space-y-2">
                {paymentMethodsChartData.map((item, idx) => {
                  const percent = totalRevenue > 0 ? (item.value / totalRevenue) * 100 : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800/50 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-zinc-900 dark:text-zinc-50">{formatCurrency(item.value)}</span>
                        <span className="text-xs text-zinc-400 ml-2">({percent.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual Bar / Summary */}
            <div className="h-64 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800/50">
              <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Distribuição Visual</p>
              {paymentMethodsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={paymentMethodsChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {paymentMethodsChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-zinc-400">Nenhum pagamento registrado no período.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Top Products Sold */}
      {sections.stock && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm print:shadow-none print:border print:border-zinc-300 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <Package className="text-blue-600" size={20} />
            Produtos Mais Vendidos no Período
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 text-xs uppercase font-bold">
                  <th className="pb-3">Produto</th>
                  <th className="pb-3 text-center">Qtd. Vendida</th>
                  <th className="pb-3 text-right">Faturamento Gerado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {topProducts.slice(0, 10).map((p, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      {p.name}
                    </td>
                    <td className="py-3 text-center font-bold text-zinc-700 dark:text-zinc-300">
                      {p.qty} un
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.revenue)}
                    </td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-xs text-zinc-400">Nenhum item vendido no período selecionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: Orders List Summary */}
      {sections.orders && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm print:shadow-none print:border print:border-zinc-300 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <ShoppingBag className="text-emerald-600" size={20} />
            Últimos Pedidos do Período ({orders.length} pedidos)
          </h3>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase font-bold">
                  <th className="pb-2">#ID</th>
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Pagamento</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {orders.slice(0, 25).map(o => (
                  <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="py-2.5 font-bold text-zinc-900 dark:text-zinc-50">#{o.id}</td>
                    <td className="py-2.5 text-zinc-500">{new Date(o.created_at).toLocaleDateString('pt-BR')} {new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2.5 font-medium text-zinc-800 dark:text-zinc-200">{o.customer?.name || 'Consumidor Final'}</td>
                    <td className="py-2.5 text-zinc-600 dark:text-zinc-300">{o.payment_method}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        o.payment_status === 'Pago' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {o.payment_status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-50">{formatCurrency(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: Customers & Loyalty */}
      {sections.customers && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm print:shadow-none print:border print:border-zinc-300 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <Users className="text-purple-600" size={20} />
            Clientes com Maior Pontuação de Fidelidade
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customersData.slice(0, 6).map((c) => (
              <div key={c.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 truncate w-40">{c.name}</p>
                  <p className="text-xs text-zinc-400">{c.phone || 'Sem telefone'}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-xl font-black text-xs">
                    ⭐ {c.loyalty_count || 0} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: Deliverymen */}
      {sections.delivery && deliveryStats.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm print:shadow-none print:border print:border-zinc-300 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <Truck className="text-amber-600" size={20} />
            Desempenho dos Entregadores no Período
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveryStats.map(d => (
              <div key={d.name} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{d.name}</p>
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className="text-zinc-500">Entregas Realizadas:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">{d.count} pedidos</span>
                </div>
                <div className="flex justify-between items-center mt-1 text-xs">
                  <span className="text-zinc-500">Valor Transportado:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(d.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corporate Sign Footer - Print only */}
      <div className="hidden print:block pt-8 mt-8 border-t border-zinc-300 text-center text-xs text-zinc-500">
        <p>Distribuidora Jardim Brasil • Sistema de Gestão Interna</p>
        <p className="mt-1">Documento emitido automaticamente para fins gerenciais e controle operacional.</p>
      </div>
    </div>
  );
}
