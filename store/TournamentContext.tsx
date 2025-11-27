
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { TournamentState, TournamentAction, Player, Pair, Match, Group } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const GROUP_NAMES = ['A', 'B', 'C', 'D'];
export const TOURNAMENT_CATEGORIES = ['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT'];

// --- Logic Helpers (Generación de cruces en memoria antes de guardar en BD) ---

const generateGroupsHelper = (pairs: Pair[]): Group[] => {
  // Asumimos que los 16 primeros pares activos (no reservas) son los que juegan
  // En un sistema real SQL, el orden viene dado por created_at
  const activePairs = pairs.filter(p => !p.isReserve).slice(0, 16);
  
  const groups: Group[] = [];
  for (let i = 0; i < 4; i++) {
    groups.push({
      id: GROUP_NAMES[i],
      pairIds: activePairs.slice(i * 4, (i + 1) * 4).map(p => p.id)
    });
  }
  return groups;
};

const generateGroupMatchesHelper = (groups: Group[]): Partial<Match>[] => {
  const matches: Partial<Match>[] = [];
  const createMatches = (groupId: string, round: number, idxs: number[][], court: number) => {
      const g = groups.find(x => x.id === groupId);
      if(!g) return [];
      return idxs.map((pairIdx, i) => {
          // Verificar que existan las parejas
          if (!g.pairIds[pairIdx[0]] || !g.pairIds[pairIdx[1]]) return null;
          return {
              round, phase: 'group' as const, bracket: null, courtId: court + i,
              pairAId: g.pairIds[pairIdx[0]], pairBId: g.pairIds[pairIdx[1]],
              scoreA: null, scoreB: null, isFinished: false
          };
      }).filter(Boolean) as Partial<Match>[];
  };
  
  // Rotación Estándar 16 parejas / 4 pistas
  matches.push(...createMatches('A', 1, [[0,1], [2,3]], 1));
  matches.push(...createMatches('B', 1, [[0,1], [2,3]], 3));
  matches.push(...createMatches('C', 1, [[0,1], [2,3]], 5));
  
  matches.push(...createMatches('A', 2, [[0,2], [1,3]], 1));
  matches.push(...createMatches('B', 2, [[0,2], [1,3]], 3));
  matches.push(...createMatches('D', 2, [[0,1], [2,3]], 5));

  matches.push(...createMatches('A', 3, [[0,3], [1,2]], 1));
  matches.push(...createMatches('C', 3, [[0,2], [1,3]], 3));
  matches.push(...createMatches('D', 3, [[0,2], [1,3]], 5));

  matches.push(...createMatches('B', 4, [[0,3], [1,2]], 1));
  matches.push(...createMatches('C', 4, [[0,3], [1,2]], 3));
  matches.push(...createMatches('D', 4, [[0,3], [1,2]], 5));

  return matches;
};

// --- Context & Provider ---

const initialState: TournamentState = {
  status: 'setup',
  currentRound: 0,
  players: [],
  pairs: [],
  matches: [],
  groups: [],
  courts: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, ballsGiven: false })),
  loading: true
};

interface TournamentContextType {
    state: TournamentState;
    dispatch: React.Dispatch<TournamentAction>;
    // Async Actions
    loadData: () => Promise<void>;
    addPlayerToDB: (p: Partial<Player>) => Promise<void>;
    updatePlayerInDB: (p: Partial<Player>) => Promise<void>;
    createPairInDB: (p1: string, p2: string) => Promise<void>;
    startTournamentDB: () => Promise<void>;
    updateScoreDB: (matchId: string, sA: number, sB: number) => Promise<void>;
    nextRoundDB: () => Promise<void>;
    deletePairDB: (pairId: string) => Promise<void>;
    archiveAndResetDB: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType>({
    state: initialState,
    dispatch: () => null,
    loadData: async () => {},
    addPlayerToDB: async () => {},
    updatePlayerInDB: async () => {},
    createPairInDB: async () => {},
    startTournamentDB: async () => {},
    updateScoreDB: async () => {},
    nextRoundDB: async () => {},
    deletePairDB: async () => {},
    archiveAndResetDB: async () => {}
});

const reducer = (state: TournamentState, action: TournamentAction): TournamentState => {
    switch (action.type) {
        case 'SET_STATE': return { ...state, ...action.payload };
        case 'SET_LOADING': return { ...state, loading: action.payload };
        case 'RESET_LOCAL': return initialState;
        case 'RESET_TOURNAMENT':
            // Reset current tournament data but keep players loaded
            return {
                ...initialState,
                players: state.players,
                loading: false
            };
        case 'LOAD_DEMO_DATA':
            // Basic demo data generation
            const demoPlayers: Player[] = Array.from({ length: 32 }, (_, i) => ({
                id: `demo-p-${i}`,
                name: `Jugador ${i + 1}`,
                categories: ['4ª CAT'],
                user_id: 'demo-user'
            }));
            const demoPairs: Pair[] = [];
            for (let i = 0; i < 16; i++) {
                demoPairs.push({
                    id: `demo-pair-${i}`,
                    player1Id: demoPlayers[i * 2].id,
                    player2Id: demoPlayers[i * 2 + 1].id,
                    name: 'Pareja Demo',
                    waterReceived: false,
                    paidP1: false,
                    paidP2: false,
                    stats: { played: 0, won: 0, gameDiff: 0 },
                    isReserve: false
                });
            }
            return {
                ...state,
                players: demoPlayers,
                pairs: demoPairs,
                status: 'setup'
            };
        case 'TOGGLE_BALLS':
            return {
                ...state,
                courts: state.courts.map(c => c.id === action.payload ? { ...c, ballsGiven: !c.ballsGiven } : c)
            };
        case 'TOGGLE_WATER':
            return {
                ...state,
                pairs: state.pairs.map(p => p.id === action.payload ? { ...p, waterReceived: !p.waterReceived } : p)
            };
        case 'TOGGLE_PAID':
            // Find pair containing the player and toggle corresponding paid flag
            return {
                ...state,
                pairs: state.pairs.map(p => {
                    if (p.player1Id === action.payload) return { ...p, paidP1: !p.paidP1 };
                    if (p.player2Id === action.payload) return { ...p, paidP2: !p.paidP2 };
                    return p;
                })
            };
        default: return state;
    }
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { user } = useAuth();

    // 1. CARGA DE DATOS (Relacional)
    const loadData = useCallback(async () => {
        if (!user) return;
        dispatch({ type: 'SET_LOADING', payload: true });

        try {
            // A. Cargar Jugadores (Globales)
            const { data: players } = await supabase.from('players').select('*').eq('user_id', user.id).order('name');
            
            // B. Buscar Torneo Activo (o Setup)
            const { data: tournaments } = await supabase.from('tournaments')
                .select('*')
                .eq('user_id', user.id)
                .neq('status', 'finished')
                .limit(1);
            
            const activeTournament = tournaments?.[0];

            if (!activeTournament) {
                // No hay torneo activo, estado limpio con jugadores
                dispatch({ type: 'SET_STATE', payload: { 
                    id: undefined,
                    status: 'setup', 
                    players: players || [], 
                    pairs: [], matches: [], groups: [] 
                }});
            } else {
                // C. Cargar Parejas y Partidos del torneo activo
                const { data: pairs } = await supabase.from('tournament_pairs')
                    .select('*')
                    .eq('tournament_id', activeTournament.id)
                    .order('created_at'); 

                const { data: matches } = await supabase.from('matches')
                    .select('*')
                    .eq('tournament_id', activeTournament.id);
                
                // Mapear Parejas
                const mappedPairs: Pair[] = (pairs || []).map(p => ({
                    id: p.id, 
                    tournament_id: p.tournament_id,
                    player1Id: p.player1_id, 
                    player2Id: p.player2_id,
                    name: p.name || 'Pareja', 
                    waterReceived: p.water_received,
                    paidP1: p.paid_p1, 
                    paidP2: p.paid_p2,
                    stats: { played: 0, won: 0, gameDiff: 0 }, // Se calcularán dinámicamente en Results
                    isReserve: false 
                }));

                // Mapear Partidos
                const mappedMatches: Match[] = (matches || []).map(m => ({
                    id: m.id, 
                    round: m.round, 
                    phase: 'group', 
                    bracket: m.bracket as any,
                    courtId: m.court_id, 
                    pairAId: m.pair_a_id, 
                    pairBId: m.pair_b_id,
                    scoreA: m.score_a, 
                    scoreB: m.score_b, 
                    isFinished: m.is_finished
                }));

                // Calcular Grupos (Derivado del orden de las parejas)
                const groups = generateGroupsHelper(mappedPairs);

                dispatch({ type: 'SET_STATE', payload: {
                    id: activeTournament.id,
                    status: activeTournament.status as any,
                    currentRound: activeTournament.current_round || 0,
                    players: players || [],
                    pairs: mappedPairs,
                    matches: mappedMatches,
                    groups: groups
                }});
            }
        } catch (e) {
            console.error("Error cargando datos:", e);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [user]);

    useEffect(() => { loadData(); }, [loadData]);

    // 2. ACCIONES (Escritura en BD)

    const addPlayerToDB = async (p: Partial<Player>) => {
        if (!user) return;
        await supabase.from('players').insert({
            user_id: user.id,
            name: p.name, nickname: p.nickname, email: p.email, phone: p.phone, categories: p.categories
        });
        loadData();
    };

    const updatePlayerInDB = async (p: Partial<Player>) => {
        if(!p.id) return;
        await supabase.from('players').update({
            name: p.name, nickname: p.nickname, email: p.email, phone: p.phone, categories: p.categories
        }).eq('id', p.id);
        loadData();
    }

    const createPairInDB = async (p1: string, p2: string) => {
        if (!user) return;
        
        let tId = state.id;
        // Si no hay torneo en memoria, crear uno nuevo en 'setup'
        if (!tId) {
            const { data, error } = await supabase.from('tournaments')
                .insert({ user_id: user.id, status: 'setup', current_round: 0 })
                .select()
                .single();
            if (error) { console.error(error); return; }
            tId = data.id;
        }
        
        await supabase.from('tournament_pairs').insert({
            tournament_id: tId, 
            player1_id: p1, 
            player2_id: p2, 
            name: `Pareja`
        });
        loadData();
    };

    const deletePairDB = async (pairId: string) => {
        await supabase.from('tournament_pairs').delete().eq('id', pairId);
        loadData();
    }

    const startTournamentDB = async () => {
        if (!state.id) return;
        
        // 1. Generar Grupos y Partidos en Memoria
        const groups = generateGroupsHelper(state.pairs);
        const matches = generateGroupMatchesHelper(groups);
        
        if (matches.length === 0) return alert("Error generando partidos. Verifica las parejas.");

        // 2. Insertar partidos en BD
        const dbMatches = matches.map(m => ({
            tournament_id: state.id,
            round: m.round, court_id: m.courtId,
            pair_a_id: m.pairAId, pair_b_id: m.pairBId,
            is_finished: false
        }));
        
        const { error } = await supabase.from('matches').insert(dbMatches);
        
        if (!error) {
            // 3. Actualizar estado del torneo
            await supabase.from('tournaments').update({ status: 'active', current_round: 1 }).eq('id', state.id);
            loadData();
        } else {
            console.error("Error creando partidos", error);
            alert("Error al iniciar torneo. Revisa la consola.");
        }
    };

    const updateScoreDB = async (matchId: string, sA: number, sB: number) => {
        await supabase.from('matches').update({
            score_a: sA, score_b: sB, is_finished: true
        }).eq('id', matchId);
        
        // Optimistic update
        const newMatches = state.matches.map(m => m.id === matchId ? { ...m, scoreA: sA, scoreB: sB, isFinished: true } : m);
        dispatch({ type: 'SET_STATE', payload: { matches: newMatches } });
    };

    const nextRoundDB = async () => {
        if (!state.id) return;
        const nextR = state.currentRound + 1;
        
        // Lógica de Playoffs (R5 en adelante)
        if (state.currentRound === 4) {
             // Aquí iría la lógica compleja de cálculo de ranking para generar cuartos de final e insertarlos en DB
             // (Simplificado para este ejemplo, pero aquí es donde se hacen los inserts de QF)
        }

        await supabase.from('tournaments').update({ current_round: nextR }).eq('id', state.id);
        dispatch({ type: 'SET_STATE', payload: { currentRound: nextR } });
    };

    const archiveAndResetDB = async () => {
        if (!state.id) return;
        // Marcar como finalizado
        await supabase.from('tournaments').update({ status: 'finished' }).eq('id', state.id);
        // Resetear estado local
        dispatch({ type: 'RESET_LOCAL' });
        loadData(); 
    };

    return (
        <TournamentContext.Provider value={{ 
            state, dispatch, loadData, addPlayerToDB, updatePlayerInDB, 
            createPairInDB, startTournamentDB, updateScoreDB, nextRoundDB, deletePairDB, archiveAndResetDB
        }}>
            {children}
        </TournamentContext.Provider>
    );
};

export const useTournament = () => useContext(TournamentContext);
