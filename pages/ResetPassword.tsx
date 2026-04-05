import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const { user, signOut, loading: authLoading } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        
        // If no user is found after auth is initialized, redirect to login
        if (!user) {
            const timer = setTimeout(() => {
                navigate('/auth');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [user, authLoading, navigate]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-2">Enlace Inválido o Expirado</h2>
                    <p className="text-slate-500 mb-6 text-sm">No se ha podido verificar tu sesión. El enlace puede haber caducado.</p>
                    <button onClick={() => navigate('/auth')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;
            setSuccess(true);
            // Cerramos la sesión de recovery y mandamos al login
            // (estándar de seguridad: reautenticarse tras cambio de contraseña)
            await supabase.auth.signOut();
            setTimeout(() => {
                navigate('/auth?password_updated=1');
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Error al actualizar la contraseña.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center animate-fade-in">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">¡Contraseña Actualizada!</h2>
                    <p className="text-slate-500 mb-6">Contraseña cambiada. Inicia sesión con tus nuevas credenciales.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <span className="text-4xl font-black italic tracking-tighter text-slate-900">
                            Para<span style={{ color: '#575AF9' }}>Pádel</span>
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2">Nueva Contraseña</h1>
                    <p className="text-slate-400 text-sm">Introduce tu nueva contraseña para recuperar el acceso.</p>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm mb-6 text-center font-medium shadow-sm break-words">
                        {error}
                    </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="relative">
                        <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                        <input
                            type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium transition-all focus:ring-4 focus:ring-indigo-50"
                            placeholder="Nueva Contraseña"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                            {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                        <input
                            type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium transition-all focus:ring-4 focus:ring-indigo-50"
                            placeholder="Repetir Nueva Contraseña"
                        />
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 mt-4 flex justify-center items-center text-lg"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Actualizar Contraseña'}
                    </button>
                </form>
                
                <div className="mt-6 text-center">
                    <button onClick={() => { signOut(); navigate('/auth'); }} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                        Cancelar y Volver
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
