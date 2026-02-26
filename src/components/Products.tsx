import { useState, useEffect, FormEvent } from 'react';
import { Package, Plus, Search, ArrowUpCircle, History, AlertCircle, Pencil, Trash2, ShieldAlert, X as CloseIcon, TrendingUp, TrendingDown, Calendar as CalendarIcon, BarChart2, PieChart, LineChart as LineChartIcon } from 'lucide-react';
import { Product, Category } from '../types';
import { supabase } from '../lib/supabase';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Gás', emoji: '📦' },
  { id: 2, name: 'Água 20L', emoji: '💧' },
  { id: 3, name: 'Água de coco', emoji: '🥥' },
  { id: 4, name: 'Refrigerante', emoji: '🥤' }
];

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProductListModalOpen, setIsProductListModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCategoryEditMode, setIsCategoryEditMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', emoji: '📦' });
  const [stockAmount, setStockAmount] = useState(0);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Report States
  const [activeTab, setActiveTab] = useState<'products' | 'reports'>('products');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterProduct, setFilterProduct] = useState<string>('all');


  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price_sell: 0,
    price_cost: 0,
    stock_quantity: 0,
    stock_min: 5
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchStockMovements();
    }
  }, [activeTab, reportPeriod, selectedDate, filterCategory, filterProduct]);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data && data.length > 0) {
        setCategories(data as Category[]);
        // Only set default category if one isn't already selected in the form
        if (!isEditMode && !formData.category) {
          setFormData(prev => ({ ...prev, category: data[0].name }));
        }
      }
    } catch (e) {
      console.error("Error fetching categories, using defaults", e);
    }
  };

  const handleCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingCategory(true);
    setCategoryError(null);
    try {
      let result;
      if (isCategoryEditMode && selectedCategory) {
        result = await supabase.from('categories').update(categoryFormData).eq('id', selectedCategory.id);
      } else {
        result = await supabase.from('categories').insert([categoryFormData]);
      }

      if (result.error) {
        setCategoryError(result.error.message);
        console.error("Erro ao salvar categoria:", result.error.message);
      } else {
        await fetchCategories();
        setIsCategoryEditMode(false);
        setSelectedCategory(null);
        setCategoryFormData({ name: '', emoji: '📦' });
        // If it was a new category, select it in the product form
        if (!isCategoryEditMode) {
          setFormData(prev => ({ ...prev, category: categoryFormData.name }));
        }
      }
    } catch (err) {
      console.error("Erro inesperado ao salvar categoria:", err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const deleteCategory = async (id: number) => {
    await supabase.from('categories').delete().eq('id', id);
    fetchCategories();
  };

  const getCategoryEmoji = (categoryName: string) => {
    return categories.find(c => c.name === categoryName)?.emoji || '📦';
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (!error && data) {
      setProducts(data as Product[]);
    } else if (error) {
      // Fallback in case the is_active column doesn't exist yet
      const { data: allData } = await supabase.from('products').select('*');
      if (allData) setProducts(allData as Product[]);
    }
  };

  const getReportDateRange = () => {
    const date = parseISO(selectedDate);
    switch (reportPeriod) {
      case 'daily':
        return { start: startOfDay(date), end: endOfDay(date) };
      case 'weekly':
        return { start: startOfWeek(date, { locale: ptBR }), end: endOfWeek(date, { locale: ptBR }) };
      case 'monthly':
      default:
        return { start: startOfMonth(date), end: endOfMonth(date) };
    }
  };

  const fetchStockMovements = async () => {
    const { start, end } = getReportDateRange();
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    const { data: movements } = await supabase
      .from('stock_movements')
      .select('*, product:products(id, name, category)')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .order('created_at', { ascending: false });

    if (movements) {
      // Apply filters locally since we're fetching relations
      let filteredMano = movements;

      if (filterCategory !== 'all') {
        filteredMano = filteredMano.filter((m: any) => m.product?.category === filterCategory);
      }
      if (filterProduct !== 'all') {
        filteredMano = filteredMano.filter((m: any) => m.product?.id.toString() === filterProduct);
      }

      setStockMovements(filteredMano);

      // Group chart data
      const chartMap = new Map<string, { name: string; Entradas: number; Saídas: number }>();
      let totalIn = 0;
      let totalOut = 0;

      if (reportPeriod === 'monthly' || reportPeriod === 'weekly') {
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

      for (const m of filteredMano) {
        const mDate = parseISO(m.created_at);
        let key = '';
        if (reportPeriod === 'daily') {
          key = `${mDate.getHours().toString().padStart(2, '0')}:00`;
        } else {
          key = format(mDate, 'dd/MM');
        }

        if (m.type === 'in') {
          totalIn += m.quantity;
          if (chartMap.has(key)) chartMap.get(key)!.Entradas += m.quantity;
        } else {
          totalOut += m.quantity;
          if (chartMap.has(key)) chartMap.get(key)!.Saídas += m.quantity;
        }
      }

      setChartData(Array.from(chartMap.values()));
      setPieData([
        { name: 'Entradas', value: totalIn, color: '#059669' },
        { name: 'Saídas', value: totalOut, color: '#DC2626' }
      ].filter(d => d.value > 0));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isEditMode && selectedProduct) {
      const { error } = await supabase
        .from('products')
        .update(formData)
        .eq('id', selectedProduct.id);

      if (!error) {
        setIsModalOpen(false);
        fetchProducts();
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert([formData]);

      if (!error) {
        setIsModalOpen(false);
        fetchProducts();
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    console.log('Attempting to delete product:', selectedProduct.id);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', selectedProduct.id);

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
      fetchProducts();
    }
  };

  const forceDeleteProduct = async () => {
    if (!selectedProduct) return;
    setIsDeleting(true);

    try {
      // 1. Delete all order items linked to this product
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('product_id', selectedProduct.id);

      if (itemsError) throw itemsError;

      // 1b. Delete all stock movements linked to this product
      const { error: moveError } = await supabase
        .from('stock_movements')
        .delete()
        .eq('product_id', selectedProduct.id);

      if (moveError) throw moveError;

      // 2. Finally delete the product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedProduct.id);

      if (error) throw error;

      setIsConflictModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error('Force delete error:', err);
      console.error('Force delete error:', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const archiveProduct = async () => {
    if (!selectedProduct) return;
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', selectedProduct.id);

    if (!error) {
      setIsConflictModalOpen(false);
      fetchProducts();
    } else {
      console.error('Erro ao arquivar:', error.message);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setSelectedProduct(null);
    setFormData({
      name: '',
      category: categories.length > 0 ? categories[0].name : '',
      price_sell: 0,
      price_cost: 0,
      stock_quantity: 0,
      stock_min: 5
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setIsEditMode(true);
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price_sell: product.price_sell,
      price_cost: product.price_cost,
      stock_quantity: product.stock_quantity,
      stock_min: product.stock_min
    });
    setIsModalOpen(true);
  };

  const handleStockUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const newStock = (selectedProduct.stock_quantity || 0) + stockAmount;

    // 1. Update stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', selectedProduct.id);

    if (!updateError) {
      // 2. Register movement
      await supabase
        .from('stock_movements')
        .insert([{
          product_id: selectedProduct.id,
          type: 'in',
          quantity: stockAmount,
          reason: 'Entrada manual'
        }]);

      setIsStockModalOpen(false);
      fetchProducts();
      setStockAmount(0);
    }
  };

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-zinc-200 rounded-xl shadow-lg">
          <p className="font-bold text-zinc-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color || entry.payload?.color }}>
              {entry.name}: {entry.value} un
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Estoque de Produtos</h2>
          <p className="text-zinc-500">Gerencie seus produtos e veja os relatórios de estoque.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'products' && (
            <>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="bg-white text-zinc-600 px-5 py-2.5 rounded-xl font-bold border border-zinc-200 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
              >
                Categorias
              </button>
              <button
                onClick={() => setIsProductListModalOpen(true)}
                className="bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-xl font-bold border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
              >
                Produtos
              </button>
              <button
                onClick={openAddModal}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Novo Produto
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-zinc-200 mb-6">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-4 px-6 text-sm font-bold transition-all relative ${activeTab === 'products' ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'}`}
        >
          <div className="flex items-center gap-2">
            <Package size={18} />
            Produtos
          </div>
          {activeTab === 'products' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-4 px-6 text-sm font-bold transition-all relative ${activeTab === 'reports' ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'}`}
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={18} />
            Relatórios
          </div>
          {activeTab === 'reports' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t-full"></div>
          )}
        </button>
      </div>

      {activeTab === 'products' ? (
        <>
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-3">
            <Search className="text-zinc-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome ou categoria..."
              className="flex-1 bg-transparent border-none outline-none text-zinc-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Produto</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Preço (Venda)</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Estoque</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-zinc-900">{product.name}</div>
                        <div className="text-xs text-zinc-400">Custo: R$ {product.price_cost.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
                          <span>{getCategoryEmoji(product.category)}</span>
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-600">
                        R$ {product.price_sell.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${product.stock_quantity <= product.stock_min ? 'text-red-600' : 'text-zinc-900'}`}>
                            {product.stock_quantity} un
                          </span>
                          {product.stock_quantity <= product.stock_min && (
                            <AlertCircle size={14} className="text-red-500" />
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Mín: {product.stock_min}</div>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setIsStockModalOpen(true);
                          }}
                          className="text-emerald-600 hover:text-emerald-700 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                          title="Entrada de Estoque"
                        >
                          <ArrowUpCircle size={20} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(product);
                          }}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Editar Produto"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Excluir Produto"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Relatórios Section */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
            <div className="flex flex-wrap items-center bg-zinc-100 p-1 rounded-xl">
              {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setReportPeriod(p)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${reportPeriod === p ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                  {p === 'daily' ? 'Diário' : p === 'weekly' ? 'Semanal' : 'Mensal'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center bg-emerald-50 p-1 rounded-xl">
              <button
                onClick={() => setChartType('bar')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${chartType === 'bar' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-100'}`}
              >
                <BarChart2 size={16} /> Barras
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${chartType === 'line' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-100'}`}
              >
                <LineChartIcon size={16} /> Linhas
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${chartType === 'pie' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-100'}`}
              >
                <PieChart size={16} /> Pizza
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex bg-zinc-50 border border-zinc-100 rounded-xl p-1 shadow-sm h-11">
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setFilterProduct('all'); // Reset dropdown product cascade
                  }}
                  className="bg-transparent border-none outline-none font-bold text-zinc-700 cursor-pointer px-3 text-sm border-r border-zinc-200"
                >
                  <option value="all">Todas as Categorias</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <select
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="bg-transparent border-none outline-none font-bold text-emerald-700 cursor-pointer px-3 text-sm"
                  disabled={filterCategory === 'all'}
                >
                  <option value="all">{filterCategory === 'all' ? 'Selecione a Categoria 1º' : 'Todos os Produtos'}</option>
                  {products
                    .filter(p => p.category === filterCategory)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 p-2 px-4 rounded-xl h-11">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
                <BarChart2 size={20} className="text-emerald-600" />
                Gráfico de Movimentações
              </h3>
              <div className="h-[350px] w-full">
                {pieData.length === 0 && chartData.reduce((acc, c) => acc + c.Entradas + c.Saídas, 0) === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-400 font-medium">Nenhum dado para exibir neste período.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} />
                        <RechartsTooltip content={<CustomChartTooltip />} cursor={{ fill: '#F4F4F5' }} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="Entradas" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="Saídas" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717A', fontSize: 12 }} />
                        <RechartsTooltip content={<CustomChartTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="Entradas" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Saídas" stroke="#DC2626" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : (
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomChartTooltip />} />
                        <Legend iconType="circle" />
                      </RechartsPieChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col h-full max-h-[445px]">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                <History size={20} className="text-zinc-400" />
                Histórico
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {stockMovements.length === 0 ? (
                  <p className="text-zinc-500 font-medium text-center py-10">Nenhum registro encontrado.</p>
                ) : (
                  stockMovements.map((mov) => (
                    <div key={mov.id} className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-zinc-900 text-sm">{mov.product?.name || 'Produto Removido'}</p>
                        <p className="text-xs text-zinc-500">{new Date(mov.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-sm flex items-center justify-end gap-1 ${mov.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {mov.type === 'in' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {mov.type === 'in' ? '+' : '-'}{mov.quantity} un
                        </p>
                        <p className="text-[10px] uppercase font-bold text-zinc-400 mt-1">{mov.type === 'in' ? 'Entrada' : 'Saída'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product List Modal */}
      {isProductListModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Produtos (Catálogo)</h3>
              <button onClick={() => setIsProductListModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400">
                <CloseIcon size={20} />
              </button>
            </div>

            <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-100">
              <p className="text-sm text-zinc-500">Gerencie a lista mestre (catálogo) de produtos e suas associações com as categorias.</p>
              <button
                onClick={() => {
                  setIsProductListModalOpen(false);
                  openAddModal();
                }}
                className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-200 transition-colors flex items-center gap-1"
              >
                <Plus size={16} /> Add Produto
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {products.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-zinc-500 font-medium">Nenhum produto cadastrado no catálogo.</p>
                </div>
              ) : (
                products.map(product => (
                  <div key={product.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-900 border-b border-zinc-200 pb-1 mb-1">{product.name}</p>
                      <p className="text-xs text-zinc-600 flex items-center gap-1">
                        <span className="font-bold px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded-md">Categoria:</span>
                        {product.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="mr-4 font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                        R$ {product.price_sell.toFixed(2)}
                      </p>
                      <button
                        onClick={() => {
                          setIsProductListModalOpen(false);
                          openEditModal(product);
                        }}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setIsProductListModalOpen(false);
                          setSelectedProduct(product);
                          setIsDeleteModalOpen(true);
                        }}
                        className="text-red-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 pt-6 border-t border-zinc-100 text-right">
              <button onClick={() => setIsProductListModalOpen(false)} className="px-6 py-2 bg-zinc-100 text-zinc-700 font-bold rounded-xl hover:bg-zinc-200">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{isEditMode ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Nome do Produto</label>
                <input
                  required
                  type="text"
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Categoria</label>
                <select
                  required
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="" disabled>Selecione uma categoria</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.emoji} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Preço Custo</label>
                  <input
                    required
                    type="number" step="0.01"
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                    value={formData.price_cost}
                    onChange={e => setFormData({ ...formData, price_cost: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Preço Venda</label>
                  <input
                    required
                    type="number" step="0.01"
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                    value={formData.price_sell}
                    onChange={e => setFormData({ ...formData, price_sell: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Estoque Inicial</label>
                  <input
                    required
                    type="number"
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                    value={formData.stock_quantity}
                    onChange={e => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1">Estoque Mínimo</label>
                  <input
                    required
                    type="number"
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                    value={formData.stock_min}
                    onChange={e => setFormData({ ...formData, stock_min: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Entry Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Entrada de Estoque</h3>
            <p className="text-zinc-500 text-sm mb-6">{selectedProduct?.name}</p>
            <form onSubmit={handleStockUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Quantidade a Adicionar</label>
                <input
                  required
                  type="number"
                  className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-emerald-500 text-2xl font-bold text-center"
                  value={stockAmount}
                  onChange={e => setStockAmount(parseInt(e.target.value))}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsStockModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Excluir Produto</h3>
            <p className="text-zinc-500 text-sm mb-6">
              Tem certeza que deseja excluir <strong>{selectedProduct?.name}</strong>? Esta ação não pode ser desfeita.
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
      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold italic">Gerenciar Categorias</h3>
              <button onClick={() => { setIsCategoryModalOpen(false); setCategoryError(null); }} className="text-zinc-400 hover:text-zinc-600">
                <CloseIcon size={24} />
              </button>
            </div>

            {categoryError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={20} className="flex-shrink-0" />
                <p className="text-xs font-bold">{categoryError}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className="font-bold text-zinc-700">{cat.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsCategoryEditMode(true);
                        setSelectedCategory(cat);
                        setCategoryFormData({ name: cat.name, emoji: cat.emoji });
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil size={18} />
                    </button>
                    {!DEFAULT_CATEGORIES.some(d => d.name === cat.name) && (
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCategorySubmit} className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200">
              <h4 className="font-bold text-sm uppercase text-zinc-400 mb-4">
                {isCategoryEditMode ? 'Editar Categoria' : 'Nova Categoria'}
              </h4>
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1 ml-1">Ícone</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-emerald-500 text-center text-xl"
                    placeholder="📦"
                    value={categoryFormData.emoji}
                    onChange={e => setCategoryFormData({ ...categoryFormData, emoji: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1 ml-1">Nome</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:border-emerald-500"
                    placeholder="Ex: Cerveja"
                    value={categoryFormData.name}
                    onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {isCategoryEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryEditMode(false);
                      setCategoryFormData({ name: '', emoji: '📦' });
                    }}
                    className="flex-1 py-2 bg-zinc-200 text-zinc-600 font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="flex-[2] py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isSavingCategory ? 'Salvando...' : (isCategoryEditMode ? 'Atualizar' : 'Adicionar')}
                </button>
              </div>
            </form>
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

            <h3 className="text-2xl font-black text-center text-zinc-900 mb-2">Conflito de Pedidos</h3>
            <p className="text-zinc-500 text-center mb-8">
              O produto <strong>{selectedProduct?.name}</strong> possui pedidos vinculados. O que deseja fazer?
            </p>

            <div className="space-y-3">
              <button
                onClick={archiveProduct}
                className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group"
              >
                <div className="text-left flex-1 px-4">
                  <div className="text-sm">Arquivar Produto</div>
                  <div className="text-[10px] text-zinc-400 font-normal">Apenas oculta da lista (Recomendado)</div>
                </div>
                <div className="bg-white/10 p-2 rounded-lg group-hover:scale-110 transition-transform">
                  <History size={18} />
                </div>
              </button>

              <button
                disabled={isDeleting}
                onClick={forceDeleteProduct}
                className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                <div className="text-left flex-1 px-4">
                  <div className="text-sm">{isDeleting ? 'Excluindo...' : 'Excluir TUDO'}</div>
                  <div className="text-[10px] text-red-400 font-normal">Apaga permanentemente o produto e seus registros</div>
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
    </div>
  );
}
