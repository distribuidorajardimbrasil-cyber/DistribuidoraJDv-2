import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, User, ShoppingBag, CreditCard, CheckCircle } from 'lucide-react';
import { Product, Customer, Category } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Gás', emoji: '📦' },
  { id: 2, name: 'Água 20L', emoji: '💧' },
  { id: 3, name: 'Água de coco', emoji: '🥥' },
  { id: 4, name: 'Refrigerante', emoji: '🥤' }
];

interface NewOrderProps {
  onComplete: () => void;
}

export default function NewOrder({ onComplete }: NewOrderProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<{ product: Product, quantity: number, customPrice: number | string }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [paymentStatus, setPaymentStatus] = useState('Pago');
  const [deliveryStatus, setDeliveryStatus] = useState('Em preparo');

  useEffect(() => {
    fetchProducts();
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

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data as Product[]);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data as Customer[]);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, customPrice: product.price_sell }]);
    }
  };

  const updateCustomPrice = (productId: number, newPriceStr: string) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        return { ...item, customPrice: newPriceStr };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    const existing = cart.find(item => item.product.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item =>
        item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
      ));
    } else {
      setCart(cart.filter(item => item.product.id !== productId));
    }
  };

  const total = cart.reduce((acc, item) => acc + ((Number(item.customPrice) || 0) * item.quantity), 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return;

    // 1. Create Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: selectedCustomer?.id || null,
        total_amount: total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        delivery_status: deliveryStatus
      }])
      .select('id')
      .single();

    if (orderError || !order) {
      console.error("Erro ao criar pedido:", orderError);
      return;
    }

    const orderId = order.id;
    let water20LCount = 0;

    // 2. Insert items and process stock if paid
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const allowedBrandsNormalized = ['GAMBOA', 'INDAIA', 'ITAGY', 'ITAGI', 'JORDAO', 'MAIORCA'];

    for (const item of cart) {
      await supabase
        .from('order_items')
        .insert([{
          order_id: orderId,
          product_id: item.product.id,
          quantity: item.quantity,
          price_at_time: Number(item.customPrice) || 0
        }]);

      if (paymentStatus === "Pago") {
        // Stock subtraction
        await supabase.from('products').update({
          stock_quantity: (item.product.stock_quantity || 0) - item.quantity
        }).eq('id', item.product.id);

        // Movement record
        await supabase.from('stock_movements').insert([{
          product_id: item.product.id,
          type: 'out',
          quantity: item.quantity,
          reason: 'Venda'
        }]);
      }

      const productName = item.product.name || "";
      const productCategory = item.product.category || "";
      const searchString = normalize(`${productName} ${productCategory}`);

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
        water20LCount += item.quantity;
      }
    }

    // 3. Loyalty and Transaction (If paid)
    if (paymentStatus === "Pago") {
      if (selectedCustomer) {
        // Stale Data Fix: Fetch latest points first
        const { data: cData } = await supabase
          .from('customers')
          .select('loyalty_count')
          .eq('id', selectedCustomer.id)
          .single();

        const currentCount = cData?.loyalty_count || 0;

        await supabase.from('customers').update({
          loyalty_count: currentCount + water20LCount
        }).eq('id', selectedCustomer.id);
      }

      await supabase.from('transactions').insert([{
        type: 'income',
        amount: total,
        description: `Venda Pedido #${orderId}`
      }]);
    }

    onComplete();
  };

  const filteredProducts = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCustomers = customers.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Product Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShoppingBag size={20} className="text-emerald-600" />
            Selecionar Produtos
          </h3>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Buscar produto..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:border-emerald-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock_quantity <= 0}
                className={`p-4 rounded-2xl border text-left transition-all ${product.stock_quantity <= 0
                  ? 'bg-zinc-50 border-zinc-100 opacity-50 cursor-not-allowed'
                  : 'bg-white border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/30'
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-zinc-100 rounded-md text-zinc-500 flex items-center gap-1.5">
                    <span>{getEmoji(product.category)}</span>
                    {product.category}
                  </span>
                  <span className="font-bold text-emerald-600">R$ {product.price_sell.toFixed(2)}</span>
                </div>
                <p className="font-bold text-zinc-900">{product.name}</p>
                <p className={`text-xs mt-1 ${product.stock_quantity <= product.stock_min ? 'text-red-500 font-bold' : 'text-zinc-400'}`}>
                  Estoque: {product.stock_quantity} un
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <User size={20} className="text-emerald-600" />
            Selecionar Cliente (Opcional)
          </h3>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:border-emerald-500"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
          </div>

          {selectedCustomer ? (
            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-emerald-900">{selectedCustomer.name}</p>
                  <p className="text-xs text-emerald-700">{selectedCustomer.phone}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-emerald-700 hover:text-red-600 font-bold text-xs">Remover</button>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {filteredCustomers.slice(0, 5).map(customer => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="flex-shrink-0 p-3 bg-zinc-50 border border-zinc-100 rounded-xl hover:bg-zinc-100 transition-all text-sm font-medium"
                >
                  {customer.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & Summary */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm sticky top-8">
          <h3 className="text-lg font-bold mb-6">Resumo do Pedido</h3>

          <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto pr-2">
            {cart.length > 0 ? cart.map(item => (
              <div key={item.product.id} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-bold text-sm text-zinc-900">{item.product.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-zinc-400 font-medium">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 px-2 py-0.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-emerald-500 font-bold text-emerald-700"
                      value={item.customPrice}
                      onChange={(e) => updateCustomPrice(item.product.id, e.target.value)}
                    />
                    <span className="text-xs text-zinc-400 font-medium ml-1">cada</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1 hover:bg-zinc-100 rounded-md text-zinc-400"><Minus size={16} /></button>
                  <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                  <button onClick={() => addToCart(item.product)} className="p-1 hover:bg-zinc-100 rounded-md text-emerald-600"><Plus size={16} /></button>
                </div>
              </div>
            )) : (
              <p className="text-zinc-400 text-center py-8 text-sm">Carrinho vazio.</p>
            )}
          </div>

          <div className="space-y-4 pt-6 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Total</span>
              <span className="text-2xl font-bold text-emerald-600">R$ {total.toFixed(2)}</span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-zinc-400 uppercase">Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {['Pix', 'Dinheiro', 'Cartão'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${paymentMethod === method ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
                      }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Status Pag.</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-zinc-50 border border-zinc-100 rounded-xl outline-none"
                >
                  <option value="Pago">Pago</option>
                  <option value="Pendente">Pendente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Status Entr.</label>
                <select
                  value={deliveryStatus}
                  onChange={e => setDeliveryStatus(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-zinc-50 border border-zinc-100 rounded-xl outline-none"
                >
                  <option value="Em preparo">Em preparo</option>
                  <option value="Saiu para entrega">Saiu entrega</option>
                  <option value="Entregue">Entregue</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={cart.length === 0}
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:shadow-none mt-4 flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} />
              Finalizar Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
