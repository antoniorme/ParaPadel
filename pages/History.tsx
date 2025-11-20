
import React, { useState } from 'react';
import { useHistory } from '../store/HistoryContext';
import { Calendar, Trophy, ChevronDown, ChevronUp } from 'lucide-react';

const History: React.FC = () => {
  const { pastTournaments } = useHistory();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDate = (isoString: string) => {
      return new Date(isoString).toLocaleDateString('es-ES', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-3xl font-bold text-slate-900">Historial de Minis</h2>
      
      {pastTournaments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <Trophy size={48} className="mx-auto text-slate-300 mb-4"/>
              <p className="text-slate-500">Aún no hay torneos finalizados.</p>
          </div>
      ) : (
          <div className="space-y-4">
              {pastTournaments.map(t => (
                  <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div 
                        onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                          <div>
                              <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold mb-1">
                                  <Calendar size={14}/> {formatDate(t.date)}
                              </div>
                              <div className="text-lg font-bold text-slate-900">Mini {t.playerCount} Jugadores</div>
                          </div>
                          <div className="bg-slate-100 p-2 rounded-full text-slate-500">
                              {expandedId === t.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                          </div>
                      </div>

                      {expandedId === t.id && (
                          <div className="bg-slate-50 p-5 border-t border-slate-100 animate-fade-in">
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                                      <div className="text-xs font-bold text-emerald-600 uppercase mb-2">Campeón Principal</div>
                                      <div className="flex items-center gap-2 font-black text-slate-800">
                                          <Trophy size={16} className="text-emerald-500"/>
                                          {t.winnerMain}
                                      </div>
                                  </div>
                                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                                      <div className="text-xs font-bold text-blue-600 uppercase mb-2">Campeón Consolación</div>
                                      <div className="flex items-center gap-2 font-black text-slate-800">
                                          <Trophy size={16} className="text-blue-500"/>
                                          {t.winnerConsolation}
                                      </div>
                                  </div>
                              </div>
                              <div className="mt-4 text-center">
                                  <span className="text-xs text-slate-400">ID: {t.id}</span>
                              </div>
                          </div>
                      )}
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

export default History;
