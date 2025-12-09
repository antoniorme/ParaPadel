

import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { FileText, Gift, Euro, Plus, X, Play, ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TournamentSetup: React.FC = () => {
    const { createNewTournament, updateTournamentSettings, state } = useTournament();
    const navigate = useNavigate();

    // Check if we are in EDIT mode (Status is setup or active)
    const isEditing = state.status !== 'finished' && !!state.id;

    // FORM STATE
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
    const [price, setPrice] = useState(15);
    const [description, setDescription] = useState('');
    const [levelRange, setLevelRange] = useState('');
    const [prizes, setPrizes] = useState<string[]>([]);
    const [prizeInput, setPrizeInput] = useState('');
    const [extras, setExtras] = useState<string[]>(['Bolas Nuevas', 'Agua']);

    // Pre-fill form if Editing
    useEffect(() => {
        if (isEditing) {
            setTitle(state.title || 'Mini Torneo');
            if (state.startDate) {
                try {
                    setDate(new Date(state.startDate).toISOString().slice(0, 16));
                } catch(e) {}
            }
            setPrice(state.price || 15);
            setDescription(state.description || '');
            setLevelRange(state.levelRange || '');
            setPrizes(state.prizes || []);
            setExtras(state.includedItems || ['Bolas Nuevas', 'Agua']);
        }
    }, [isEditing, state]);

    const suggestedExtras = ['Bolas Nuevas', 'Agua', 'Fruta', 'Cerveza', 'Camiseta', 'Grip'];

    const handleAddPrize = () => {
        if(prizeInput.trim()) {
            setPrizes([...prizes, prizeInput.trim()]);
            setPrizeInput('');
        }
    };

    const removePrize = (idx: number) => {
        setPrizes(prizes.filter((_, i) => i !== idx));
    };

    const toggleExtra = (item: string) => {
        if (extras.includes(item)) setExtras(extras.filter(i => i !== item));
        else setExtras([...extras, item]);
    };

    const handleSubmit = async () => {
        if (!title) return alert("El título es obligatorio");
        
        const metadata = {
            title,
            startDate: date,
            price,
            description,
            levelRange: levelRange || 'Abierto',
            prizes,
            includedItems: extras
        };

        if (isEditing) {
            await updateTournamentSettings(metadata);
            alert("Información actualizada correctamente");
        } else {
            await createNewTournament(metadata);
        }

        navigate('/dashboard');
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-full text-slate-600"><ArrowLeft size={20} /></button>
                <h2 className="text-2xl font-bold text-slate-900">{isEditing ? 'Editar Torneo' : 'Crear Nuevo Torneo'}</h2>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <FileText size={16}/> Datos del Evento (Público)
                  </div>

                  {/* TITLE & DATE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1">Título del Torneo</label>
                          <input 
                            autoFocus
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-[#575AF9]" 
                            placeholder="Ej. Pozo Viernes Noche"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1">Fecha y Hora</label>
                          <input 
                            type="datetime-local"
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-[#575AF9]" 
                          />
                      </div>
                  </div>

                  {/* PRICE & LEVEL */}
                  <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                           <label className="text-xs font-bold text-slate-500 uppercase mb-1">Precio / Jugador</label>
                           <div className="relative">
                               <Euro size={16} className="absolute left-3 top-3.5 text-slate-400"/>
                               <input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-9 font-bold text-slate-800 outline-none focus:border-[#575AF9]"/>
                           </div>
                        </div>
                        <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1">Categorías / Nivel</label>
                             <input value={levelRange} onChange={e => setLevelRange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-[#575AF9]" placeholder="Ej. 3ª y 4ª Cat"/>
                        </div>
                  </div>
                  
                  {/* INCLUDED EXTRAS */}
                  <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Incluido con la inscripción</label>
                        <div className="flex flex-wrap gap-2">
                            {suggestedExtras.map(ex => (
                                <button key={ex} onClick={() => toggleExtra(ex)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${extras.includes(ex) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-400 border-slate-200'}`}>{ex}</button>
                            ))}
                        </div>
                   </div>

                  {/* DESCRIPTION */}
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1">Descripción (Opcional)</label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 outline-none focus:border-[#575AF9] h-24 resize-none" placeholder="Información adicional para los jugadores..."/>
                  </div>
                  
                  {/* PRIZES */}
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Gift size={14}/> Premios</label>
                      <div className="flex gap-2 mb-2">
                          <input value={prizeInput} onChange={e => setPrizeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPrize()} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm outline-none focus:border-[#575AF9]" placeholder="Ej. Palas Nox AT10"/>
                          <button onClick={handleAddPrize} className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900"><Plus size={20}/></button>
                      </div>
                      <div className="flex flex-col gap-1">
                          {prizes.map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-amber-50 p-3 rounded-xl border border-amber-100 text-sm text-amber-800 font-medium">
                                  <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🎁'} {p}</span>
                                  <button onClick={() => removePrize(idx)} className="text-amber-400 hover:text-amber-600"><X size={14}/></button>
                              </div>
                          ))}
                          {prizes.length === 0 && <p className="text-xs text-slate-400 italic p-2">No hay premios añadidos.</p>}
                      </div>
                  </div>

                  <button 
                    onClick={handleSubmit} 
                    style={{ backgroundColor: THEME.cta }} 
                    className="w-full py-5 rounded-xl font-bold text-white text-lg shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 hover:opacity-90 mt-4"
                  >
                      {isEditing ? <Save size={24}/> : <Play size={24} fill="currentColor" />} 
                      {isEditing ? 'GUARDAR CAMBIOS' : 'PUBLICAR Y ABRIR INSCRIPCIONES'}
                  </button>
            </div>
        </div>
    );
};

export default TournamentSetup;
