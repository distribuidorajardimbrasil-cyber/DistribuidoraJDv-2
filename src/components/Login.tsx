import React, { useState } from 'react';
import { Truck, ShieldCheck, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface LoginProps {
    onLogin: (profile: Profile) => void;
}

export default function Login({ onLogin }: LoginProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await fetchAndSetProfile(session.user.id);
            }
        };
        checkSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                // Login Flow
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (authError) throw authError;

                if (data.user) {
                    await fetchAndSetProfile(data.user.id);
                }
            } else {
                // Register Flow
                const { data, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            name: name,
                        }
                    }
                });

                if (authError) {
                    // Se for erro de rate limit ou usuario já existe, tenta fazer o login direto
                    if (authError.message.includes('rate limit') || authError.message.includes('already registered')) {
                        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
                        if (loginError) throw loginError;
                        if (loginData.user) await fetchAndSetProfile(loginData.user.id);
                        return;
                    }
                    throw authError;
                }

                if (data.user) {
                    await fetchAndSetProfile(data.user.id);
                }
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            if (err.message.includes('rate limit')) {
                setError('Limite de tentativas de segurança atingido. Tente novamente mais tarde.');
            } else {
                setError(err.message || 'Ocorreu um erro durante a autenticação.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchAndSetProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            setError('Erro ao carregar perfil. Fale com um administrador.');
            console.error(error);
            return;
        }

        if (data) {
            onLogin(data as Profile);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-zinc-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        {isLogin ? <ShieldCheck size={32} /> : <User size={32} />}
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900">
                        {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        {isLogin ? 'Faça login para acessar o sistema JD.' : 'Registre-se para acessar a distribuidora.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700">
                        <AlertCircle className="shrink-0 mt-0.5" size={18} />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1 ml-1">Nome Completo</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                                    placeholder="João Silva"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1 ml-1">E-mail</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1 ml-1">Senha</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                        ) : (
                            isLogin ? 'Entrar no Sistema' : 'Criar Conta'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null);
                        }}
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors"
                    >
                        {isLogin ? 'Não tem uma conta? Registre-se' : 'Já tem uma conta? Faça login'}
                    </button>
                </div>
            </div>
        </div>
    );
}
