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
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
            {/* Background Gradient & Animated Elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a192f] via-[#0b3142] to-[#044c45] z-0">
                {/* Decorative bubbles - pure CSS */}
                <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 right-10 w-16 h-16 bg-white dark:bg-zinc-900/5 rounded-full blur-md"></div>
                <div className="absolute top-20 right-40 w-8 h-8 rounded-full border border-white/10 backdrop-blur-sm"></div>
                <div className="absolute bottom-40 left-20 w-12 h-12 rounded-full border border-white/10 backdrop-blur-sm"></div>

                {/* SVG Curves for background depth */}
                <svg className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,50 Q25,20 50,50 T100,50 L100,0 L0,0 Z" fill="none" stroke="currentColor" strokeWidth="0.1" className="text-emerald-500" />
                    <path d="M0,80 Q25,50 50,80 T100,80 L100,100 L0,100 Z" fill="none" stroke="currentColor" strokeWidth="0.1" className="text-blue-500" />
                </svg>
            </div>

            {/* Login Card */}
            <div className="w-full max-w-md z-10 flex flex-col shadow-2xl dark:shadow-none rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* White Top Header */}
                <div className="bg-white dark:bg-zinc-900 px-8 py-6 flex items-center gap-4">
                    <img src="/logo.png" alt="Distribuidora JD" className="h-14 w-auto object-contain" />
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-extrabold text-[#0a192f] tracking-tight leading-none">Distribuidora JD</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Água e Gás</p>
                    </div>
                </div>

                {/* Glassmorphism Body */}
                <div className="p-8 backdrop-blur-xl bg-white dark:bg-zinc-900/10 border-t border-white/20">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white mb-1">
                            {isLogin ? 'Olá, Bem-vindo' : 'Criar Conta'}
                        </h2>
                        <p className="text-sm text-emerald-50/70">
                            {isLogin ? 'Acesse sua conta para gerenciar seus pedidos' : 'Preencha os dados para se cadastrar'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-100 backdrop-blur-md">
                            <AlertCircle className="shrink-0 mt-0.5" size={18} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-emerald-50/80 mb-1 ml-1">Nome Completo</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-100/50">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900/5 border border-white/20 rounded-2xl outline-none focus:border-emerald-400 focus:bg-white dark:bg-zinc-900/10 text-white placeholder-emerald-100/30 transition-all font-medium"
                                        placeholder="João Silva"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-emerald-50/80 mb-1 ml-1">E-mail</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-100/50">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900/5 border border-white/20 rounded-2xl outline-none focus:border-emerald-400 focus:bg-white dark:bg-zinc-900/10 text-white placeholder-emerald-100/30 transition-all font-medium"
                                    placeholder="exemplo@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1 ml-1 mr-1">
                                <label className="block text-sm font-medium text-emerald-50/80">Senha</label>
                                {isLogin && (
                                    <button type="button" className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-100/50">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900/5 border border-white/20 rounded-2xl outline-none focus:border-emerald-400 focus:bg-white dark:bg-zinc-900/10 text-white placeholder-emerald-100/30 transition-all font-medium"
                                    placeholder="••••••••••••"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#00c875] hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-full transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg dark:shadow-none shadow-emerald-900/50"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                ) : (
                                    <>
                                        {isLogin ? 'Entrar no Sistema' : 'Criar Conta'}
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2">
                        <span className="text-emerald-50/70 text-sm">
                            {isLogin ? 'Não tem conta?' : 'Já tem uma conta?'}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError(null);
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-bold text-sm transition-colors"
                        >
                            {isLogin ? 'Cadastre-se' : 'Faça login'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
