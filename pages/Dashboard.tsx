
import React, { useState, useEffect } from 'react';
import { useTournament } from '../store/TournamentContext';
import { THEME, getFormatColor } from '../utils/theme';
import { useHistory } from '../store/HistoryContext';
import { useTimer } from '../store/TimerContext';
import { 
    Users, PlayCircle, Clock, Play, Trophy, Share2, 
    Smartphone, Link, Check, Settings, Edit, Shuffle, 
    ListOrdered, TrendingUp, X, Check as CheckIcon, 
    AlertTriangle, Lock, ArrowLeft, Calendar, LayoutGrid, 
    Hourglass, Gift, FileText, MessageCircle, Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Modal, StatCard } from '../components';
import { TournamentFormat, GenerationMethod, Pair, Player } from '../types';
import ClubDashboard from './ClubDashboard';

// --- HELPERS ---
const getNumEmoji = (n: number) => {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    if (n <= 10) return emojis[n];
    return n.toString().split('').map(digit => emojis[parseInt(digit)]).join('');
};

// --- COMPONENTS ---

// 1. MANUAL WIZARD
interface WizardProps {
    pairs: Pair[];
    players: Player[];
    onComplete: (orderedPairs: Pair[]) => void;
    onCancel: () => void;
    formatName: (p?: Player) => string;
    limit: number; 
}

const ManualGroupingWizard: React.FC<WizardProps> = ({ pairs, players, onComplete, onCancel, formatName, limit }) => {
    const [currentGroupIdx, setCurrentGroupIdx] = useState(0); 
    const [orderedPairs, setOrderedPairs] = useState<Pair[]>([]);
    
    let groupNames = ['G1', 'G2', 'G3', 'G4'];
    if (limit === 10) groupNames = ['G1', 'G2'];
    if (limit === 8) groupNames = ['G1', 'G2'];
    if (limit === 12) groupNames = ['G1', 'G2', 'G3'];
    
    const effectiveGroupSize = limit === 10 ? 5 : 4;
    const currentGroup = groupNames[currentGroupIdx];
    const assignedIds = new Set(orderedPairs.map(p => p.id));
    const availablePairs = pairs.filter(p => !assignedIds.has(p.id));
    const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);

    const toggleSelection = (id: string) => {
        if (selectedForGroup.includes(id)) setSelectedForGroup(selectedForGroup.filter(pid => pid !== id));
        else if (selectedForGroup.length < effectiveGroupSize) setSelectedForGroup([...selectedForGroup, id]);
    };

    const confirmGroup = () => {
        if (selectedForGroup.length !== effectiveGroupSize) return;
        const newGroupPairs = selectedForGroup.map(id => pairs.find(p => p.id === id)!);
        const newOrder = [...orderedPairs, ...newGroupPairs];
        setOrderedPairs(newOrder); setSelectedForGroup([]);
        if (currentGroupIdx < groupNames.length - 1) setCurrentGroupIdx(currentGroupIdx + 1);
        else onComplete(newOrder);
    };

    return (
        <Modal
            isOpen={true}
            onClose={onCancel}
            title={`Configurar Grupo ${currentGroup}`}
            body={`Selecciona ${effectiveGroupSize} parejas de la lista`}
            size="md"
            actions={[
                { label: 'Cancelar', onClick: onCancel, variant: 'secondary' },
                { label: currentGroupIdx === groupNames.length - 1 ? 'Finalizar y Empezar' : `Confirmar Grupo ${currentGroup} >`, onClick: confirmGroup, variant: 'primary' },
            ]}
        >
            <div className="max-h-64 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-2">
                {availablePairs.map(pair => {
                    const p1 = players.find(p => p.id === pair.player1Id);
                    const p2 = players.find(p => p.id === pair.player2Id);
                    const isSelected = selectedForGroup.includes(pair.id);
                    return (
                        <div key={pair.id} onClick={() => toggleSelection(pair.id)} className={`p-2 rounded-xl border-2 flex flex-col items-start cursor-pointer transition-all ${isSelected ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                            <div className="w-full">
                                <div className="font-bold text-slate-800 text-xs truncate">{formatName(p1)}</div>
                                <div className="font-bold text-slate-600 text-xs truncate">{formatName(p2)}</div>
                            </div>
                            {isSelected && <div className="mt-1 self-end"><CheckIcon size={14} className="text-[#575AF9]" strokeWidth={3}/></div>}
                        </div>
                    )
                })}
                </div>
            </div>
            <div className="text-center font-bold text-[#575AF9] text-sm mt-3">
                Seleccionadas: {selectedForGroup.length} / {effectiveGroupSize}
            </div>
        </Modal>
    );
};

// 2. MAIN DASHBOARD
const Dashboard: React.FC = () => {
  const { state, startTournamentDB, setTournamentFormat, formatPlayerName, closeTournament } = useTournament();
  const { clubData } = useHistory();
  const { resetTimer, startTimer } = useTimer();
  const { user } = useAuth();
  const navigate = useNavigate();

  // LOCAL UI STATE
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('elo-balanced');
  const [showManualWizard, setShowManualWizard] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ROUTING CHECK
  if (!state.id || state.status === 'finished') {
      return <ClubDashboard />;
  }

  // --- CALCULATIONS ---
  const isSetupMode = state.status === 'setup';
  const isActiveMode = state.status === 'active';
  
  const limitMap: Record<TournamentFormat, number> = { '16_mini': 16, '12_mini': 12, '10_mini': 10, '8_mini': 8 };
  const currentLimit = limitMap[state.format] || 16;
  
  const confirmedPairs = state.pairs.filter(p => p.player2Id && p.status === 'confirmed');
  const totalConfirmed = confirmedPairs.filter(p => !p.isReserve).length;
  const titularPairs = confirmedPairs.filter(p => !p.isReserve).slice(0, currentLimit);
  const reservePairs = confirmedPairs.filter(p => p.isReserve || confirmedPairs.indexOf(p) >= currentLimit);
  
  const canStart = titularPairs.length >= currentLimit;
  const missingPairs = Math.max(0, currentLimit - titularPairs.length);

  const dateObj = new Date(state.startDate || Date.now());
  const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
  const dateStr = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }).toUpperCase();
  const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // --- SHARE LOGIC ---
  const generateWhatsAppMessage = () => {
      const clubHeader = `🎾${clubData.name.toUpperCase()}🎾`;
      const tourneyTitle = `\n${state.title?.toUpperCase() || 'MINI TORNEO'} 🎾\n`;
      
      const details = ` • ${dayName} ${dateStr} \n • NIVEL // ${state.levelRange || 'ABIERTO'} \n • HORA // ${timeStr}h ⏱ \n • INSCRIPCION // ${state.price}€ con ${state.includedItems?.join(', ') || 'agua y bolas'}\n • MODALIDAD: BOLA DE ORO\n`;
      
      const separator = `➖➖➖➖➖➖➖➖➖➖\n`;
      
      let prizesText = ` Premios : 🏆\n`;
      if (state.prizes && state.prizes.length > 0) {
          state.prizes.forEach((p, i) => {
              const label = i === 0 ? '-Campeones' : i === 1 ? '-Subcampeones' : '-Consolación';
              prizesText += `${label}: ${p}\n`;
          });
      } else {
          prizesText += `-A determinar\n`;
      }

      const listHeader = `\n 👇🏼 LISTA INSCRITOS👇🏼\n\n`;
      
      let listBody = "";
      titularPairs.forEach((pair, idx) => {
          const p1 = state.players.find(p => p.id === pair.player1Id);
          const p2 = state.players.find(p => p.id === pair.player2Id);
          listBody += `${getNumEmoji(idx + 1)} ${formatPlayerName(p1)} y ${formatPlayerName(p2)}\n`;
      });
      
      // Fill empty slots if any
      for (let i = titularPairs.length; i < currentLimit; i++) {
          listBody += `${getNumEmoji(i + 1)} ________________\n`;
      }

      let reservesText = `\n Reservas \n`;
      if (reservePairs.length > 0) {
          reservePairs.forEach(pair => {
              const p1 = state.players.find(p => p.id === pair.player1Id);
              const p2 = state.players.find(p => p.id === pair.player2Id);
              reservesText += `-${formatPlayerName(p1)} y ${formatPlayerName(p2)}\n`;
          });
      } else {
          reservesText += `-Vacío\n`;
      }

      const footer = `\n🔗 ¡Apúntate aquí!\n${window.location.origin}/#/join/${user?.id}`;

      return `${clubHeader}\n${tourneyTitle}\n${details}${separator}${prizesText}${listHeader}${listBody}${reservesText}${footer}`;
  };

  const handleCopyMessage = () => {
      const msg = generateWhatsAppMessage();
      navigator.clipboard.writeText(msg);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
      const msg = encodeURIComponent(generateWhatsAppMessage());
      window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleStartTournament = async () => {
      if (generationMethod === 'manual') { setShowManualWizard(true); return; }
      try { 
          await startTournamentDB(generationMethod); 
          resetTimer(); startTimer();
          setShowGenerationModal(false);
          navigate('/active');
      } catch (e: any) { setErrorMessage(e.message || "Error al iniciar."); }
  };

  const handleManualWizardComplete = async (orderedPairs: Pair[]) => {
      setShowManualWizard(false);
      try { 
          await startTournamentDB('manual', orderedPairs); 
          resetTimer(); startTimer();
          setShowGenerationModal(false);
          navigate('/active');
      } catch (e: any) { setErrorMessage(e.message || "Error manual."); }
  };


  return (
    <div className="pb-10 space-y-6">
      
      {/* 1. TOP NAVIGATION & HEADER */}
      <div>
          <button onClick={() => { closeTournament(); navigate('/dashboard'); }} className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors mb-4 px-1">
              <ArrowLeft size={18}/> Volver al Club
          </button>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Trophy size={120} /></div>
              <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isSetupMode ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {isSetupMode ? 'Inscripción' : 'En Juego'}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Calendar size={12}/> {dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })}, {timeStr}
                        </span>
                    </div>
                    <button onClick={() => navigate('/setup')} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-lg transition-colors">
                        <Edit size={16}/>
                    </button>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 leading-tight">{state.title || 'Torneo Sin Título'}</h1>
                  <div className="flex flex-wrap gap-2 pt-1">
                      {state.levelRange && <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-xs font-bold text-slate-600 border border-slate-200"><TrendingUp size={12}/> {state.levelRange}</div>}
                      {state.prizes && state.prizes.length > 0 && <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md text-xs font-bold text-amber-700 border border-amber-100"><Gift size={12}/> {state.prizes[0]}{state.prizes.length > 1 ? ` +${state.prizes.length-1}` : ''}</div>}
                  </div>
              </div>
          </div>
      </div>

      {/* 2. KEY METRICS GRID (Responsive 2 cols -> 4 cols on Desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            value={`${titularPairs.length}/${currentLimit}`}
            label="Inscritos"
            delta={reservePairs.length > 0 ? `+${reservePairs.length} Reservas` : undefined}
            deltaType="neutral"
            icon={<Users size={20} />}
            onClick={() => navigate('/registration')}
          />
          {isActiveMode ? (
              <StatCard
                value={`Ronda ${state.currentRound}`}
                label="Ronda Actual"
                icon={<Clock size={20} />}
                valueColor="success"
                onClick={() => navigate('/active')}
              />
          ) : (
              <StatCard
                value={`Mini ${currentLimit}`}
                label="Formato"
                icon={<LayoutGrid size={20} />}
                valueColor="brand"
                onClick={() => navigate('/setup')}
              />
          )}
          <StatCard
            value="Pistas"
            label="Control"
            icon={<Settings size={20} />}
            onClick={() => navigate('/checkin')}
          />
          <StatCard
            value="Live"
            label="Resultados"
            icon={<Trophy size={20} />}
            valueColor="warning"
            onClick={() => navigate('/results')}
          />
      </div>

      {/* 3. SETUP PHASE PANEL */}
      {isSetupMode && (
          <div className="animate-fade-in space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} className="text-slate-400"/> Gestión de Inscripciones</h3>
                  
                  {/* Progress Bar */}
                  <div className="mb-2 flex justify-between text-xs font-bold">
                      <span className={missingPairs > 0 ? "text-amber-600" : "text-emerald-600"}>{missingPairs > 0 ? `Faltan ${missingPairs} parejas` : '¡Completo!'}</span>
                      <span className="text-slate-400">{Math.round((titularPairs.length / currentLimit) * 100)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                      <div className={`h-full transition-all duration-500 rounded-full ${missingPairs > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min((titularPairs.length / currentLimit) * 100, 100)}%` }}></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button onClick={() => navigate('/registration')} className="w-full py-3 bg-white border-2 border-slate-100 text-slate-700 font-bold rounded-xl hover:border-indigo-200 transition-all flex items-center justify-center gap-2">
                          <Users size={18}/> Lista Jugadores
                      </button>
                      <button onClick={() => setShowShareModal(true)} className="w-full py-3 bg-indigo-50 border border-indigo-100 text-[#575AF9] font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 shadow-sm">
                          <Share2 size={18}/> Convocatoria WhatsApp
                      </button>
                  </div>
              </div>

              {/* Launch Button */}
              <button 
                onClick={() => setShowGenerationModal(true)}
                disabled={!canStart}
                style={{ backgroundColor: canStart ? THEME.cta : '#e2e8f0' }}
                className={`w-full py-6 rounded-xl font-black text-white text-lg shadow-lg flex flex-col items-center justify-center gap-1 transition-all ${canStart ? 'hover:opacity-90 active:scale-95' : 'cursor-not-allowed text-slate-400'}`}
              >
                  <div className="flex items-center gap-2">
                    {canStart ? <Play size={24} fill="currentColor"/> : <Lock size={24}/>}
                    {canStart ? 'GENERAR CUADROS Y EMPEZAR' : 'NECESITAS EL CUPO COMPLETO'}
                  </div>
                  {!canStart && <span className="text-[10px] font-bold uppercase opacity-60">Faltan {missingPairs} parejas titulares</span>}
              </button>
          </div>
      )}

      {/* 4. ACTIVE PHASE PANEL */}
      {isActiveMode && (
          <div className="animate-slide-up space-y-4">
              <button onClick={() => navigate('/active')} style={{ backgroundColor: THEME.cta }} className="w-full py-8 text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-200 flex flex-col items-center justify-center gap-2 hover:opacity-90 transition-colors">
                  <div className="flex items-center gap-3"><PlayCircle size={32} fill="currentColor"/> IR AL DIRECTO</div>
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full text-white uppercase tracking-wider">Gestionar Partidos</span>
              </button>
          </div>
      )}

      <Modal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Compartir Torneo"
          icon={<MessageCircle size={28} />}
          iconColor="success"
          size="md"
          actions={[
              { label: linkCopied ? '¡Copiado!' : 'Copiar Texto', onClick: handleCopyMessage, variant: 'secondary' },
              { label: 'Mandar a WhatsApp', onClick: handleOpenWhatsApp, variant: 'primary' },
          ]}
      >
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-700 select-all max-h-48 overflow-y-auto text-left">
              {generateWhatsAppMessage()}
          </div>
      </Modal>

      <Modal
          isOpen={showGenerationModal}
          onClose={() => setShowGenerationModal(false)}
          title="Tipo de Sorteo"
          size="md"
          actions={[
              { label: 'EMPEZAR YA', onClick: handleStartTournament, variant: 'primary' },
          ]}
      >
          <div className="space-y-2 text-left">
              <button onClick={() => setGenerationMethod('elo-balanced')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${generationMethod === 'elo-balanced' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}><TrendingUp size={20} className="text-[#575AF9]"/><div><div className="font-bold text-slate-900 text-sm">Por Nivel (Equilibrado)</div><div className="text-xs text-slate-500">Mejores al Grupo A, peores al D.</div></div></button>
              <button onClick={() => setGenerationMethod('elo-mixed')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${generationMethod === 'elo-mixed' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}><Shuffle size={20} className="text-[#575AF9]"/><div><div className="font-bold text-slate-900 text-sm">Mix (Cremallera)</div><div className="text-xs text-slate-500">Reparte el nivel en todos los grupos.</div></div></button>
              <button onClick={() => setGenerationMethod('arrival')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${generationMethod === 'arrival' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}><Hourglass size={20} className="text-[#575AF9]"/><div><div className="font-bold text-slate-900 text-sm">Orden de Llegada</div><div className="text-xs text-slate-500">Estricto orden de inscripción.</div></div></button>
              <button onClick={() => setGenerationMethod('manual')} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${generationMethod === 'manual' ? 'border-[#575AF9] bg-indigo-50' : 'border-slate-100'}`}><ListOrdered size={20} className="text-[#575AF9]"/><div><div className="font-bold text-slate-900 text-sm">Manual</div><div className="text-xs text-slate-500">Tú decides los grupos uno a uno.</div></div></button>
          </div>
      </Modal>

      <Modal
          isOpen={!!errorMessage}
          onClose={() => setErrorMessage(null)}
          title="Error"
          body={errorMessage ?? undefined}
          icon={<AlertTriangle size={28} />}
          iconColor="danger"
          actions={[{ label: 'Cerrar', onClick: () => setErrorMessage(null), variant: 'secondary' }]}
      />
      {showManualWizard && (<ManualGroupingWizard pairs={confirmedPairs.slice(0, currentLimit)} players={state.players} onCancel={() => setShowManualWizard(false)} onComplete={handleManualWizardComplete} formatName={formatPlayerName} limit={currentLimit} />)}

    </div>
  );
};

export default Dashboard;
