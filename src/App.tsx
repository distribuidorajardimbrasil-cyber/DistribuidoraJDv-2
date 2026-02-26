import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  PlusCircle,
  Menu,
  X,
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile } from './types';
import { supabase } from './lib/supabase';

// Components
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Customers from './components/Customers';
import Orders from './components/Orders';
import Finance from './components/Finance';
import NewOrder from './components/NewOrder';
import Login from './components/Login';
import Team from './components/Team';

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'customers' | 'orders' | 'finance' | 'new-order' | 'team'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Set default tab when profile loads
  useEffect(() => {
    if (profile) {
      if (profile.role === 'admin') {
        setActiveTab('dashboard');
      } else if (profile.role === 'entregador') {
        setActiveTab('orders');
      }
    } else {
      // Auto sign in check
      const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id as any).single();
          if (data) setProfile(data as any as Profile);
        }
      };
      checkSession();
    }
  }, [profile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  if (!profile) {
    return <Login onLogin={setProfile} />;
  }

  // Handle Pending State
  if (profile.role === 'pending') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-zinc-100 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Conta em Análise</h1>
          <p className="text-zinc-600 mb-6">Sua conta foi criada com sucesso, mas você precisa aguardar a aprovação de um Administrador para acessar o sistema.</p>
          <button
            onClick={handleLogout}
            className="mx-auto block text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';

  let navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-order', label: 'Novo Pedido', icon: PlusCircle, primary: true },
    { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
    { id: 'products', label: 'Estoque', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'team', label: 'Equipe', icon: ShieldAlert },
  ];

  if (!isAdmin) {
    navItems = [
      { id: 'orders', label: 'Pedidos (Entregas)', icon: ShoppingCart, primary: true }
    ];
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return isAdmin ? <Dashboard onNavigate={setActiveTab} /> : null;
      case 'products': return isAdmin ? <Products /> : null;
      case 'customers': return isAdmin ? <Customers /> : null;
      case 'orders': return <Orders profile={profile} />; // Passes profile down if needed
      case 'finance': return isAdmin ? <Finance /> : null;
      case 'new-order': return isAdmin ? <NewOrder onComplete={() => setActiveTab('orders')} /> : null;
      case 'team': return isAdmin ? <Team /> : null;
      default: return isAdmin ? <Dashboard onNavigate={setActiveTab} /> : <Orders profile={profile} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row font-sans text-zinc-900">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <h1 className="font-bold text-emerald-600 text-xl">Distribuidora JD</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Hide entirely on desktop if Entregador, but we need navigation still. Let's keep a minimal one. */}
      {(!isAdmin && window.innerWidth >= 768) ? (
        <aside className="w-16 bg-white border-r border-zinc-200 flex flex-col items-center py-6 gap-6">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-xl font-bold">JD</div>
          <button title="Sair" onClick={handleLogout} className="mt-auto p-3 text-red-500 hover:bg-red-50 rounded-xl">
            <LogOut size={20} />
          </button>
        </aside>
      ) : (
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 768) && (
            <motion.aside
              initial={false}
              animate={{ x: 0 }} // Simplified for the inline condition below
              className={`fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-zinc-200 z-40 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
            >
              <div className="p-6 hidden md:block">
                <h1 className="font-bold text-emerald-600 text-2xl tracking-tight">Distribuidora JD</h1>
                <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-semibold">{isAdmin ? 'Gestão Interna' : 'Acesso Entregador'}</p>
              </div>

              <nav className="mt-4 px-3 space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id
                      ? (item.primary ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-zinc-100 text-emerald-600 font-medium')
                      : (item.primary ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900')
                      }`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="absolute bottom-0 w-full p-6 border-t border-zinc-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {(profile.name || 'US').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate w-[110px]">{profile.name || 'Usuário'}</p>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">{profile.role || 'user'}</p>
                  </div>
                </div>
                <button title="Sair" onClick={handleLogout} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </main>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
