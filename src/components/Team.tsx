import { useState, useEffect } from 'react';
import { ShieldCheck, Truck, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export default function Team() {
    const [team, setTeam] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTeam();
    }, []);

    const fetchTeam = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (data) setTeam(data as Profile[]);
        setLoading(false);
    };

    const updateRole = async (id: string, newRole: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', id);

            if (error) throw error;

            fetchTeam();
        } catch (error: any) {
            console.error("Erro ao atualizar cargo: ", error.message);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Equipe e Acessos</h2>
                    <p className="text-zinc-500">Gerencie quem tem acesso ao sistema da distribuidora.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {team.map(member => (
                    <div key={member.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${member.role === 'admin' ? 'bg-indigo-100 text-indigo-600' :
                                member.role === 'entregador' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                {member.role === 'admin' ? <ShieldCheck size={24} /> :
                                    member.role === 'entregador' ? <Truck size={24} /> : <Clock size={24} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg text-zinc-900 truncate">{member.name}</h3>
                                <p className="text-sm text-zinc-500 flex items-center gap-1">
                                    {member.role === 'pending' && <ShieldAlert size={14} className="text-amber-500" />}
                                    <span className="uppercase font-semibold tracking-wider text-[10px]">{member.role === 'pending' ? 'Aguardando Aprovação' : member.role}</span>
                                </p>
                            </div>
                        </div>

                        <div className="mt-2 pt-4 border-t border-zinc-100">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Definir Acesso</label>
                            <select
                                value={member.role}
                                onChange={(e) => updateRole(member.id, e.target.value)}
                                className={`w-full p-3 rounded-xl border outline-none font-medium transition-colors cursor-pointer ${member.role === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-800 focus:border-amber-500' :
                                    member.role === 'admin' ? 'bg-indigo-50 border-indigo-200 text-indigo-800 focus:border-indigo-500' :
                                        'bg-emerald-50 border-emerald-200 text-emerald-800 focus:border-emerald-500'
                                    }`}
                            >
                                <option value="pending">Aguardando Avaliação (Bloqueado)</option>
                                <option value="entregador">Entregador (Acesso às Entregas)</option>
                                <option value="admin">Administrador (Acesso Total)</option>
                            </select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
