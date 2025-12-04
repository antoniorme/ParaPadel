
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from '../store/HistoryContext';
import { Building, Check } from 'lucide-react';

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { updateClubData } = useHistory();
    const [form, setForm] = useState({ name: '', courtCount: 6, address: '', phone: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateClubData(form);
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl animate-scale-in">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                        <Building size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Configura tu Club</h1>
                    <p className="text-slate-500 mt-2">Para organizar los torneos correctamente, necesitamos algunos datos básicos.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nombre del Club</label>
                        <input 
                            required
                            value={form.name}
                            onChange={e => setForm({...form, name: e.target.value})}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-lg"
                            placeholder="Ej. Padel Center"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Número de Pistas</label>
                        <input 
                            type="number"
                            min="1"
                            max="50"
                            required
                            value={form.courtCount}
                            onChange={e => setForm({...form, courtCount: parseInt(e.target.value) || 0})}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold text-lg text-center"
                        />
                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                            Si tienes 8 o más pistas, los torneos de 16 parejas se jugarán sin descansos.
                        </p>
                    </div>

                    <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                        <Check size={20} /> Guardar y Continuar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Onboarding;
