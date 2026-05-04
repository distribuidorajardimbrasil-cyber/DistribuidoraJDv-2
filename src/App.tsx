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
  ShieldAlert,
  Truck,
  ChevronRight,
  Sun,
  Moon,
  MapPin
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
import Deliverymen from './components/Deliverymen';
import LiveMap from './components/LiveMap';

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'customers' | 'orders' | 'finance-overview' | 'finance-payments' | 'finance-rates' | 'new-order' | 'team' | 'deliverymen' | 'live-map'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    if (newVal) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

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

  // Track location if entregador
  useEffect(() => {
    let watchId: number;

    if (profile?.role === 'entregador' && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          try {
            await supabase.from('deliveryman_locations').upsert({
              deliveryman_id: profile.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              updated_at: new Date().toISOString()
            });
          } catch (error) {
            console.error('Erro ao atualizar localização:', error);
          }
        },
        (error) => {
          console.warn('Erro na geolocalização:', error.message);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl dark:shadow-none border border-zinc-100 dark:border-zinc-800/50 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Conta em Análise</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">Sua conta foi criada com sucesso, mas você precisa aguardar a aprovação de um Administrador para acessar o sistema.</p>
          <button
            onClick={handleLogout}
            className="mx-auto block text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-50 font-medium transition-colors"
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
    { id: 'orders', label: 'Pedidos (Entregas)', icon: ShoppingCart },
    { id: 'products', label: 'Estoque', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'finance', label: 'Financeiro', icon: DollarSign, isExpandable: true },
    { id: 'team', label: 'Equipe', icon: ShieldAlert },
    { id: 'deliverymen', label: 'Entregadores', icon: Truck },
    { id: 'live-map', label: 'Mapa ao Vivo', icon: MapPin },
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
      case 'orders': return <Orders profile={profile} isFinanceMode={false} />;
      case 'finance-overview': return isAdmin ? <Finance tab="overview" /> : null;
      case 'finance-payments': return isAdmin ? <Orders profile={profile} isFinanceMode={true} /> : null;
      case 'finance-rates': return isAdmin ? <Finance tab="rates" /> : null;
      case 'new-order': return isAdmin ? <NewOrder onComplete={() => setActiveTab('orders')} /> : null;
      case 'team': return isAdmin ? <Team /> : null;
      case 'deliverymen': return isAdmin ? <Deliverymen /> : null;
      case 'live-map': return isAdmin ? <LiveMap /> : null;
      default: return isAdmin ? <Dashboard onNavigate={setActiveTab} /> : <Orders profile={profile} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row font-sans text-zinc-900 dark:text-zinc-50">
      {/* Mobile Header */}
      <div className="md:hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-50">
        <img src="/logo.png" alt="Distribuidora JD" className="h-12 w-auto object-contain mix-blend-multiply" />
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Hide entirely on desktop if Entregador, but we need navigation still. Let's keep a minimal one. */}
      {(!isAdmin && window.innerWidth >= 768) ? (
        <aside className="w-16 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-6 gap-6">
          <img src="/logo.png" alt="JD" className="w-12 h-12 object-contain mix-blend-multiply" />
          <div className="mt-auto flex flex-col gap-2">
            <button onClick={toggleDarkMode} title="Alternar Tema" className="p-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl transition-colors">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button title="Sair" onClick={handleLogout} className="p-3 text-red-500 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-xl transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </aside>
      ) : (
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 768) && (
            <motion.aside
              initial={false}
              animate={{ x: 0 }} // Simplified for the inline condition below
              className={`fixed md:static inset-y-0 left-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 z-40 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
            >
              <div className="p-6 hidden md:block">
                <img src="/logo.png" alt="Distribuidora JD" className="h-20 -ml-2 w-auto object-contain mb-1 mix-blend-multiply drop-shadow-sm dark:shadow-none" />
                <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-semibold">{isAdmin ? 'Gestão Interna' : 'Acesso Entregador'}</p>
              </div>

              <nav className="mt-4 px-3 space-y-1">
                {navItems.map((item) => (
                  <div key={item.id}>
                    <button
                      onClick={() => {
                        if (item.isExpandable) {
                          setIsFinanceOpen(!isFinanceOpen);
                        } else {
                          setActiveTab(item.id as any);
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                        (!item.isExpandable && activeTab === item.id) || (item.isExpandable && activeTab.startsWith('finance-'))
                        ? (item.primary ? 'bg-emerald-600 text-white shadow-lg dark:shadow-none shadow-emerald-200' : 'bg-zinc-100 dark:bg-zinc-800/50 text-emerald-600 dark:text-emerald-400 font-medium')
                        : (item.primary ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:bg-emerald-900/40' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-950 hover:text-zinc-900 dark:text-zinc-50')
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {item.isExpandable && (
                        <div className={`transition-transform duration-200 ${isFinanceOpen || activeTab.startsWith('finance-') ? 'rotate-90' : ''}`}>
                          <ChevronRight size={16} />
                        </div>
                      )}
                    </button>
                    
                    {/* Sub-menu for Financeiro */}
                    {item.isExpandable && (isFinanceOpen || activeTab.startsWith('finance-')) && (
                      <div className="mt-1 ml-4 pl-4 border-l-2 border-zinc-100 dark:border-zinc-800/50 space-y-1">
                        <button
                          onClick={() => { setActiveTab('finance-overview'); setIsSidebarOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === 'finance-overview' ? 'bg-zinc-100 dark:bg-zinc-800/50 text-emerald-600 dark:text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-950 hover:text-zinc-900 dark:text-zinc-50'}`}
                        >
                          Visão Geral
                        </button>
                        <button
                          onClick={() => { setActiveTab('finance-payments'); setIsSidebarOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === 'finance-payments' ? 'bg-zinc-100 dark:bg-zinc-800/50 text-emerald-600 dark:text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-950 hover:text-zinc-900 dark:text-zinc-50'}`}
                        >
                          Pagamentos Pendentes
                        </button>
                        <button
                          onClick={() => { setActiveTab('finance-rates'); setIsSidebarOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === 'finance-rates' ? 'bg-zinc-100 dark:bg-zinc-800/50 text-emerald-600 dark:text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-950 hover:text-zinc-900 dark:text-zinc-50'}`}
                        >
                          Taxas Maquineta
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </nav>

              <div className="absolute bottom-0 w-full border-t border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/50/50 flex justify-center">
                  <button onClick={toggleDarkMode} className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-50 w-full p-2 rounded-xl hover:bg-zinc-50 dark:bg-zinc-950 transition-colors">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="text-sm font-medium">{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                  </button>
                </div>
                <div className="p-6 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isAdmin ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'}`}>
                      {(profile.name || 'US').trim().substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold truncate w-[110px]">{profile.name || 'Usuário'}</p>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">{profile.role || 'user'}</p>
                    </div>
                  </div>
                  <button title="Sair" onClick={handleLogout} className="p-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-xl transition-colors">
                    <LogOut size={20} />
                  </button>
                </div>
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
