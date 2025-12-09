

import React, { useState } from 'react';
import { useHistory } from '../../store/HistoryContext';
import { THEME } from '../../utils/theme';
import { Search, Calendar, Heart, ArrowRight, Filter, ChevronDown, ChevronUp, Gift, Trophy, MapPin, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TournamentBrowser: React.FC = () => {
    const { globalTournaments, favoriteClubIds, toggleFavoriteClub } = useHistory();
    const navigate = useNavigate();
    const [viewFilter, setViewFilter] = useState<'all' | 'favorites'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    const filteredTournaments = globalTournaments.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              t.clubName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFav = viewFilter === 'all' || favoriteClubIds.includes(t.clubId);
        
        return matchesSearch && matchesFav;
    });

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="p-6 space-y-6 pb-24">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900">Explorar</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setViewFilter('all')} 
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${viewFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                        Todos
                    </button>
                    <button 
                        onClick={() => setViewFilter('favorites')} 
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1 ${viewFilter === 'favorites' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                        <Heart size={12} fill={viewFilter === 'favorites' ? "currentColor" : "none"}/> Favoritos
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                <input 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar club o torneo..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-[#575AF9] font-bold text-slate-700 placeholder:font-normal"
                />
            </div>

            {/* Tournaments List */}
            <div className="space-y-4">
                {filteredTournaments.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Filter size={48} className="mx-auto mb-4 opacity-20"/>
                        <p>No se encontraron torneos.</p>
                        {viewFilter === 'favorites' && <p className="text-sm mt-2">Marca clubs como favoritos ❤️ para verlos aquí.</p>}
                    </div>
                ) : (
                    filteredTournaments.map(t => {
                        const isFav = favoriteClubIds.includes(t.clubId);
                        const isFull = t.spotsTaken >= t.spotsTotal;
                        const isExpanded = expandedId === t.id;

                        return (
                            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                                {/* Club Header */}
                                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{t.clubLogo}</span>
                                        <span className="font-bold text-slate-700 text-sm">{t.clubName}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleFavoriteClub(t.clubId); }}
                                        className={`p-2 rounded-full transition-all active:scale-95 ${isFav ? 'text-rose-500 bg-rose-50' : 'text-slate-300 hover:bg-slate-100'}`}
                                    >
                                        <Heart size={18} fill={isFav ? "currentColor" : "none"} />
                                    </button>
                                </div>
                                
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-slate-900 text-lg leading-tight w-3/4">{t.name}</h3>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-slate-900">{t.price}€</div>
                                        </div>
                                    </div>

                                    {/* INFO TAGS */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                            MINI TORNEO
                                        </span>
                                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                                            {t.level}
                                        </span>
                                        {t.prizes && t.prizes.length > 0 && (
                                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                                <Trophy size={10}/> PREMIOS
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* LOCATION ROW */}
                                    {t.address && (
                                        <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-lg">
                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold truncate">
                                                <MapPin size={14} className="text-slate-400 shrink-0"/> {t.address}
                                            </div>
                                            {t.mapsUrl && (
                                                <a href={t.mapsUrl} target="_blank" rel="noopener noreferrer" className="bg-white p-1.5 rounded-md border border-slate-200 text-blue-600 hover:text-blue-700 hover:border-blue-200 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                                    <ExternalLink size={14}/>
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-6">
                                        <div className="flex items-center gap-1"><Calendar size={14} className="text-[#575AF9]"/> {formatDate(t.date)}</div>
                                        <div className="flex items-center gap-1"><ArrowRight size={12}/> {formatTime(t.date)}</div>
                                        <div className={`ml-auto flex items-center gap-1 ${isFull ? 'text-rose-500' : 'text-emerald-600'}`}>
                                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-900">{t.spotsTaken}/{t.spotsTotal}</span>
                                        </div>
                                    </div>

                                    {/* PRIZES EXPANDABLE SECTION */}
                                    {isExpanded && t.prizes && (
                                        <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-100 animate-slide-up">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                                <Gift size={14}/> Premios
                                            </div>
                                            <ul className="space-y-1">
                                                {t.prizes.map((prize, idx) => (
                                                    <li key={idx} className="text-sm font-medium text-slate-700">
                                                        {prize}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex gap-2 items-center">
                                        {t.prizes && t.prizes.length > 0 && (
                                            <button 
                                                onClick={(e) => toggleExpand(t.id, e)}
                                                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-1 transition-colors"
                                                title="Ver Premios"
                                            >
                                                {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                            </button>
                                        )}
                                        
                                        <button 
                                            onClick={() => navigate(`/join/${t.clubId}`)}
                                            disabled={isFull}
                                            style={{ backgroundColor: isFull ? '#e2e8f0' : THEME.cta, color: isFull ? '#94a3b8' : 'white' }}
                                            className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                                        >
                                            {isFull ? 'Completo' : 'Inscribirse'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TournamentBrowser;