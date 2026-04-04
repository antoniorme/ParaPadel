
import React from 'react';
import { useAuth } from '../store/AuthContext';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PendingVerification: React.FC = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-6 items-center justify-center text-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-slate-200 animate-scale-in">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                    <Clock size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-4">Verificación Pendiente</h1>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    Tu usuario ha sido registrado correctamente, pero necesita ser validado por la administración antes de acceder.
                </p>
                <button 
                    onClick={handleLogout}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                    Volver al Inicio
                </button>
            </div>
        </div>
    );
};

export default PendingVerification;
