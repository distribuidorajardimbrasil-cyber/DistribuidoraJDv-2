import { useState, useEffect } from 'react';
import { Truck, Search, Calendar as CalendarIcon, Filter, MapPin, User, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, Order } from '../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = 'daily' | 'weekly' | 'monthly' | 'all';

interface DeliverymanOrder extends Omit<Order, 'items'> {
    customer_name: string;
    customer_address: string;
    items: { product_name: string; product_category: string; quantity: number }[];
}

export default function Deliverymen() {
    const [deliverymen, setDeliverymen] = useState<Profile[]>([]);
    const [selectedManId, setSelectedManId] = useState<string>('all');
    const [orders, setOrders] = useState<DeliverymanOrder[]>([]);
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

    const [period, setPeriod] = useState<Period>('daily');
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDeliverymen();
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [selectedManId, period, selectedDate]);

    const fetchDeliverymen = async () => {
        const { data } = await supabase.from('profiles').select('id, name, role').eq('role', 'entregador');
        if (data) setDeliverymen(data as Profile[]);
    };

    const getDateRange = () => {
        if (period === 'all') return null;
        const date = parseISO(selectedDate);
        switch (period) {
            case 'daily':
                return { start: startOfDay(date).toISOString(), end: endOfDay(date).toISOString() };
            case 'weekly':
                return { start: startOfWeek(date, { locale: ptBR }).toISOString(), end: endOfWeek(date, { locale: ptBR }).toISOString() };
            case 'monthly':
            default:
                return { start: startOfMonth(date).toISOString(), end: endOfMonth(date).toISOString() };
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        let query: any = supabase
            .from('orders')
            .select('*, customer:customers(name, address), items:order_items(quantity, product:products(name, category))')
            .not('deliveryman_id', 'is', null)
            .order('created_at', { ascending: false });

        if (selectedManId !== 'all') {
            query = query.eq('deliveryman_id', selectedManId);
        }

        const range = getDateRange();
        if (range) {
            query = query.gte('created_at', range.start).lte('created_at', range.end);
        }

        const { data } = await query;

        if (data) {
            const formatted = data.map((o: any) => ({
                ...o,
                customer_name: o.customer?.name || 'Consumidor',
                customer_address: o.customer?.address || 'Retirada na loja',
                items: (o.items || []).map((i: any) => ({
                    product_name: i.product?.name,
                    product_category: i.product?.category,
                    quantity: i.quantity
                }))
            }));
            setOrders(formatted);
        }
        setLoading(false);
    };

    const deliverymanNameMap = Object.fromEntries(deliverymen.map(d => [d.id, d.name]));

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Truck className="text-emerald-600" />
                        Entregadores
                    </h2>
                    <p className="text-zinc-500">Acompanhe o histórico de entregas da equipe.</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 p-2 px-3 rounded-xl">
                        <User size={18} className="text-zinc-400" />
                        <select
                            value={selectedManId}
                            onChange={(e) => setSelectedManId(e.target.value)}
                            className="bg-transparent border-none outline-none font-bold text-zinc-700 cursor-pointer text-sm w-40 truncate"
                        >
                            <option value="all">Todos os Entregadores</option>
                            {deliverymen.map(man => (
                                <option key={man.id} value={man.id}>{man.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center bg-zinc-100 p-1 rounded-xl">
                        {(['daily', 'weekly', 'monthly', 'all'] as Period[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${period === p ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                            >
                                {p === 'daily' ? 'Diário' : p === 'weekly' ? 'Semanal' : p === 'monthly' ? 'Mensal' : 'Tudo'}
                            </button>
                        ))}
                    </div>
                </div>

                {period !== 'all' && (
                    <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 p-2 px-4 rounded-xl">
                        <CalendarIcon size={20} className="text-zinc-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none outline-none font-bold text-zinc-700 cursor-pointer"
                        />
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"></div>
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-12 text-center text-zinc-500 font-medium">
                    <Truck size={48} className="mx-auto text-zinc-200 mb-4" />
                    Nenhum histórico de entrega encontrado para os filtros selecionados.
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-emerald-200 transition-colors">
                            <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-lg">Pedido #{order.id}</p>
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                                                {order.delivery_status}
                                            </span>
                                        </div>
                                        <div className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
                                            <span className="font-medium text-zinc-800">
                                                Entregador: {order.deliveryman_id ? deliverymanNameMap[order.deliveryman_id] || 'Desconhecido' : 'N/A'}
                                            </span>
                                            <span>•</span>
                                            <span>{new Date(order.created_at).toLocaleString('pt-BR')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="font-bold text-emerald-600">{formatCurrency(order.total_amount)}</p>
                                        <p className="text-xs text-zinc-400 capitalize">{order.payment_method}</p>
                                    </div>
                                    <div className="text-zinc-400">
                                        {expandedOrderId === order.id ? <ChevronUp /> : <ChevronDown />}
                                    </div>
                                </div>
                            </div>

                            {expandedOrderId === order.id && (
                                <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={14} /> Destino</p>
                                        <p className="font-bold text-zinc-800 mb-1">{order.customer_name}</p>
                                        <p className="text-sm text-zinc-600">{order.customer_address}</p>
                                    </div>
                                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Package size={14} /> Itens Entregues</p>
                                        <ul className="space-y-2">
                                            {order.items.map((item, idx) => (
                                                <li key={idx} className="flex justify-between text-sm">
                                                    <span className="text-zinc-600">
                                                        <span className="font-bold text-zinc-900 mr-2">{item.quantity}x</span>
                                                        {item.product_category} {item.product_name}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
