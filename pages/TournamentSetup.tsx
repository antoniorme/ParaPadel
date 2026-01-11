
import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { FileText, Gift, Euro, Plus, X, Play, ArrowLeft, Save, AlertTriangle, Check, LayoutGrid, Users, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TournamentFormat } from '../types';

const TournamentSetup: React.FC = () => {
    const { createNewTournament, updateTournamentSettings, state } = useTournament();
    const navigate = useNavigate();

    // Check if we are in EDIT mode (Status is setup or active)
    const isEditing = state.status !== 'finished' && !!state.id;

    // FORM STATE
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
    const [price, setPrice] = useState(15);
    const [format, setFormat] = useState<TournamentFormat>('16_mini');
    const [description, setDescription] = useState('');
    const [levelRange, setLevelRange] = useState('Abierto');
    const [prizes, setPrizes] = useState<string[]>([]);
    const [prizeInput, setPrizeInput] = useState('');
    const [extras, setExtras] = useState<string[]>(['Bolas Nuevas', 'Agua']);
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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
            setFormat(state.format || '16_mini');
            setDescription(state.description || '');
            setLevelRange(state.levelRange || 'Abierto');
            setPrizes(state.prizes || []);
            setExtras(state.includedItems || ['Bolas Nuevas', 'Agua']);
        }
    }, [isEditing, state]);

    const suggestedExtras = ['Bolas Nuevas', 'Agua', 'Fruta', 'Cerveza', 'Camiseta', 'Grip'];
    
    // COMPLEX LEVEL OPTIONS
    const levelOptions = [
        "Abierto",
        "Iniciación",
        "5ª Categoría",
        "5ª Alta",
        "5ª Alta - 4ª Baja",
        "4ª Categoría",
        "4ª Alta",
        "4ª Alta - 3ª Baja",
        "3ª Categoría",
        "3ª Alta",
        "2ª Categoría",
        "1ª Categoría"
    ];

    const formats: { id: TournamentFormat, label: string, desc: string }[] = [
        { id: '16_mini', label: '16 Parejas', desc: '4 Grupos de 4' },
        { id: '12_mini', label: '12 Parejas', desc: '3 Grupos de 4' },
        { id: '10_mini', label: '10 Parejas', desc: '2 Grupos de 5' },
        { id: '8_mini', label: '8 Parejas', desc: '2 Grupos de 4' },
    ];

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
        if (!title) {
            setAlertMessage({ type: 'error', message: "El título es obligatorio." });
            return;
        }
        
        const metadata = {
            title,
            startDate: date,
            price,
            format,
            description,
            levelRange: levelRange || 'Abierto',
            prizes,
            includedItems: extras
        };

        if (isEditing) {
            await updateTournamentSettings(metadata);
            setAlertMessage({ type: 'success', message: "Información actualizada correctamente." });
        } else {
            await createNewTournament(metadata);
            navigate('/dashboard');
        }
    };

    const closeAlert = () => {
        setAlertMessage(null);
        if (alertMessage?.type === 'success' && isEditing) {
            navigate('/dashboard');
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-full text-slate-600"><ArrowLeft size={20} /></button>
                <h2 className="text-2xl font-bold text-slate-900">{isEditing ? 'Configuración' : 'Nuevo Torneo'}</h2>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
                  
                  {/* TIPO DE MINI (FORMATO) */}
                  <div>
                      <div className="flex items-center gap-2 mb-4 text-slate-400 font-bold text-xs uppercase tracking-wider">
                          <LayoutGrid size={16}/> Tipo de Mini (Cupo de Parejas)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {formats.map(f => (
                              <button 
                                key={f.id}
                                disabled={state.status === 'active'}
                                onClick={() => setFormat(f.id)}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${format === f.id ? 'border-[#575AF9] bg-indigo-50 text-[#575AF9] shadow-md' : 'border-slate-100 text-slate-400 hover:border-slate-200 bg-white'} ${state.status === 'active' ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                  <Users size={24} strokeWidth={format === f.id ? 3 : 2}/>
                                  <span className="text-sm font-black whitespace-nowrap">{f.label}</span>
                                  <span className="text-[9px] font-bold opacity-60 uppercase">{f.desc}</span>
                              </button>
                          ))}
                      </div>
                      {state.status === 'active' && (
                          <p className="text-[10px] text-rose-500 font-bold mt-2 uppercase flex items-center gap-1">
                              <AlertTriangle size={10}/> El formato no se puede cambiar con el torneo en curso.
                          </p>
                      )}
                  </div>

                  <div className="h-px bg-slate-100 w-full"></div>

                  <div className="flex items-center gap-2 mb-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <FileText size={16}/> Datos del Evento (Público)
                  </div>

                  {/* TITLE & DATE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1">Título del Torneo</label>
                          <input 
                            autoFocus={!isEditing}
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
                        <div className="relative">
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1">Categoría / Nivel</label>
                             <div className="relative">
                                 <select 
                                    value={levelRange} 
                                    onChange={e => setLevelRange(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-8 font-bold text-slate-800 outline-none focus:border-[#575AF9] appearance-none"
                                 >
                                     {levelOptions.map(opt => (
                                         <option key={opt} value={opt}>{opt}</option>
                                     ))}
                                 </select>
                                 <ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
                             </div>
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
                          <button onClick={handleAddPrize} className="bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-900 font-bold text-xs uppercase tracking-wide whitespace-nowrap">
                              Añadir
                          </button>
                      </div>
                      <div className="flex flex-col gap-1">
                          {prizes.map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-amber-50 p-3 rounded-xl border border-amber-100 text-sm text-amber-800 font-medium">
                                  <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🎁'} {p}</span>
                                  <button onClick={() => removePrize(idx)} className="text-amber-400 hover:text-amber-600"><X size={14}/></button>
                              </div>
                          ))}
                      </div>
                  </div>

                  <button 
                    onClick={handleSubmit} 
                    style={{ backgroundColor: THEME.cta }} 
                    className="w-full py-5 rounded-xl font-bold text-white text-lg shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 hover:opacity-90 mt-4"
                  >
                      {isEditing ? <Save size={24}/> : <Play size={24} fill="currentColor" />} 
                      {isEditing ? 'GUARDAR CONFIGURACIÓN' : 'PUBLICAR Y ABRIR INSCRIPCIONES'}
                  </button>
            </div>

            {/* ALERT MODAL */}
            {alertMessage && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${alertMessage.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {alertMessage.type === 'error' ? <AlertTriangle size={32} /> : <Check size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">{alertMessage.type === 'error' ? 'Atención' : 'Guardado'}</h3>
                        <p className="text-slate-500 mb-6">{alertMessage.message}</p>
                        <button onClick={closeAlert} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">
                            {alertMessage.type === 'error' ? 'Revisar' : 'Continuar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentSetup;
