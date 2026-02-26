import { useState, useEffect } from 'react';
import {
  PlusCircle,
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { Product, Order, Category } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Gás', emoji: '📦' },
  { id: 2, name: 'Água 20L', emoji: '💧' },
  { id: 3, name: 'Água de coco', emoji: '🥥' },
  { id: 4, name: 'Refrigerante', emoji: '🥤' }
];

interface DashboardProps {
  onNavigate: (tab: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({
    dailyTotal: 0,
    monthlyTotal: 0,
    monthlyExpenses: 0,
    profit: 0
  });
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    fetchStats();
    fetchLowStock();
    fetchRecentOrders();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const getEmoji = (catName: string) => {
    return categories.find(c => c.name === catName)?.emoji || '📦';
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const monthPrefix = today.substring(0, 7);

    // 1. Transactions for Daily/Monthly totals and expenses
    const { data: trans } = await supabase.from('transactions').select('*');
    if (trans) {
      let dailyTotal = 0;
      let monthlyTotal = 0;
      let monthlyExpenses = 0;

      for (const t of trans) {
        const dbDate = (t.created_at || '').substring(0, 10);
        const dbMonth = (t.created_at || '').substring(0, 7);

        if (t.type === 'income') {
          if (dbMonth === monthPrefix) monthlyTotal += t.amount;
          if (dbDate === today) dailyTotal += t.amount;
        } else if (t.type === 'expense') {
          if (dbMonth === monthPrefix) monthlyExpenses += t.amount;
        }
      }

      // 2. Profit calculation (Paid orders this month)
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_status', 'Pago')
        .like('created_at', `${monthPrefix}%`);

      let profitTotal = 0;
      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, quantity, price_at_time')
          .in('order_id', orderIds);

        if (items) {
          const productIds = [...new Set(items.map(i => i.product_id))];
          const { data: prods } = await supabase
            .from('products')
            .select('id, price_cost')
            .in('id', productIds);

          if (prods) {
            const costMap = Object.fromEntries(prods.map(p => [p.id, p.price_cost]));
            for (const item of items) {
              const cost = costMap[item.product_id!] || 0;
              profitTotal += (item.price_at_time - cost) * item.quantity;
            }
          }
        }
      }

      setStats({
        dailyTotal,
        monthlyTotal,
        monthlyExpenses,
        profit: profitTotal
      });
    }
  };

  const fetchLowStock = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) {
      setLowStock((data as Product[]).filter(p => p.stock_quantity <= (p.stock_min || 0)));
    }
  };

  const fetchRecentOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(name)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      const formatted = data.map((o: any) => ({
        ...o,
        customer_name: o.customer?.name || null
      }));
      setRecentOrders(formatted);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Olá, JD! 👋</h2>
          <p className="text-zinc-500">Aqui está o resumo da sua distribuidora hoje.</p>
        </div>
        <button
          onClick={() => onNavigate('new-order')}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
        >
          <PlusCircle size={20} />
          Novo Pedido
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Vendas Hoje"
          value={formatCurrency(stats.dailyTotal)}
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          title="Vendas no Mês"
          value={formatCurrency(stats.monthlyTotal)}
          icon={TrendingUp}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          title="Despesas (Mês)"
          value={formatCurrency(stats.monthlyExpenses)}
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard
          title="Lucro Estimado"
          value={formatCurrency(stats.profit)}
          icon={CheckCircle}
          color="text-indigo-600"
          bg="bg-indigo-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Low Stock Alerts */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              Estoque Baixo
            </h3>
            <button onClick={() => onNavigate('products')} className="text-sm text-emerald-600 font-medium hover:underline">Ver tudo</button>
          </div>
          <div className="space-y-4">
            {lowStock.length > 0 ? lowStock.map(product => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">
                    {getEmoji(product.category)}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{product.name}</p>
                    <p className="text-xs text-amber-700">{product.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-900">{product.stock_quantity} un</p>
                  <p className="text-[10px] text-amber-600 uppercase font-bold">Mín: {product.stock_min}</p>
                </div>
              </div>
            )) : (
              <p className="text-zinc-400 text-center py-8">Tudo certo com o estoque!</p>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart className="text-emerald-600" size={20} />
              Pedidos Recentes
            </h3>
            <button onClick={() => onNavigate('orders')} className="text-sm text-emerald-600 font-medium hover:underline">Ver todos</button>
          </div>
          <div className="space-y-4">
            {recentOrders.length > 0 ? recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{order.customer_name || 'Consumidor Final'}</p>
                    <p className="text-xs text-zinc-400">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-zinc-900">{formatCurrency(order.total_amount)}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${order.payment_status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    {order.payment_status}
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-zinc-400 text-center py-8">Nenhum pedido hoje.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
      <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center mb-4`}>
        <Icon size={24} />
      </div>
      <p className="text-sm text-zinc-500 font-medium">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function CheckCircle({ size, className }: any) {
  return <CheckCircle2 size={size} className={className} />;
}
