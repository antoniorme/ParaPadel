
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { TournamentState, TournamentAction, Player, Pair, Match, Group } from '../types';

const GROUP_NAMES = ['A', 'B', 'C', 'D'];
const STORAGE_KEY = 'padelpro_tournament_data_v1';

const initialState: TournamentState = {
  status: 'setup',
  currentRound: 0,
  players: [],
  pairs: [],
  matches: [],
  groups: [],
  courts: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, ballsGiven: false })),
};

export const TOURNAMENT_CATEGORIES = ['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT'];

// --- Logic Helpers ---

export const generateGroups = (pairs: Pair[]): Group[] => {
  // Only take the first 16 active pairs (exclude reserves)
  const activePairs = pairs.filter(p => !p.isReserve).slice(0, 16);
  const shuffled = [...activePairs].sort(() => 0.5 - Math.random());
  const groups: Group[] = [];
  for (let i = 0; i < 4; i++) {
    groups.push({
      id: GROUP_NAMES[i],
      pairIds: shuffled.slice(i * 4, (i + 1) * 4).map(p => p.id)
    });
  }
  return groups;
};

export const generateGroupMatches = (groups: Group[]): Match[] => {
  const matches: Match[] = [];
  const createMatchesForGroup = (groupId: string, round: number, pairIndices: number[][], startCourt: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    const newMatches: Match[] = [];
    pairIndices.forEach((indices, idx) => {
        newMatches.push({
            id: `m-r${round}-${groupId}-${idx}`,
            round,
            phase: 'group',
            bracket: null,
            courtId: startCourt + idx,
            pairAId: group.pairIds[indices[0]],
            pairBId: group.pairIds[indices[1]],
            scoreA: null,
            scoreB: null,
            isFinished: false
        });
    });
    return newMatches;
  };

  // R1: A(1,2), B(3,4), C(5,6)
  matches.push(...createMatchesForGroup('A', 1, [[0,1], [2,3]], 1));
  matches.push(...createMatchesForGroup('B', 1, [[0,1], [2,3]], 3));
  matches.push(...createMatchesForGroup('C', 1, [[0,1], [2,3]], 5));

  // R2: A(1,2), B(3,4), D(5,6)
  matches.push(...createMatchesForGroup('A', 2, [[0,2], [1,3]], 1));
  matches.push(...createMatchesForGroup('B', 2, [[0,2], [1,3]], 3));
  matches.push(...createMatchesForGroup('D', 2, [[0,1], [2,3]], 5));

  // R3: A(1,2), C(3,4), D(5,6)
  matches.push(...createMatchesForGroup('A', 3, [[0,3], [1,2]], 1));
  matches.push(...createMatchesForGroup('C', 3, [[0,2], [1,3]], 3));
  matches.push(...createMatchesForGroup('D', 3, [[0,2], [1,3]], 5));

  // R4: B(1,2), C(3,4), D(5,6)
  matches.push(...createMatchesForGroup('B', 4, [[0,3], [1,2]], 1));
  matches.push(...createMatchesForGroup('C', 4, [[0,3], [1,2]], 3));
  matches.push(...createMatchesForGroup('D', 4, [[0,3], [1,2]], 5));

  return matches;
};

const calculateRankings = (pairs: Pair[], matches: Match[], groups: Group[]) => {
    const pairStats: Record<string, { won: number, diff: number, id: string }> = {};
    pairs.forEach(p => {
        pairStats[p.id] = { won: 0, diff: 0, id: p.id };
    });

    matches.filter(m => m.phase === 'group' && m.isFinished).forEach(m => {
        if (m.scoreA !== null && m.scoreB !== null) {
            const diff = m.scoreA - m.scoreB;
            
            pairStats[m.pairAId].diff += diff;
            pairStats[m.pairBId].diff -= diff;

            if (diff > 0) pairStats[m.pairAId].won += 1;
            else if (diff < 0) pairStats[m.pairBId].won += 1;
        }
    });

    const updatedPairs = pairs.map(p => ({
        ...p,
        stats: {
            played: 3,
            won: pairStats[p.id].won,
            gameDiff: pairStats[p.id].diff
        }
    }));

    const groupRankings: Record<string, string[]> = {};
    groups.forEach(g => {
        const groupPairs = g.pairIds.map(pid => updatedPairs.find(p => p.id === pid)!);
        groupPairs.sort((a, b) => {
            if (b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
            if (b.stats.gameDiff !== a.stats.gameDiff) return b.stats.gameDiff - a.stats.gameDiff;
            return 0; 
        });
        groupRankings[g.id] = groupPairs.map(p => p.id);
    });

    return { updatedPairs, groupRankings };
};

const generatePlayoffMatches = (pairIdMap: Record<string, string[]>) => {
    const getP = (g: string, pos: number) => pairIdMap[g][pos - 1];

    const matches: Match[] = [];
    
    // QF Main (Round 5)
    matches.push({ id: `qf-m-1`, round: 5, phase: 'qf', bracket: 'main', courtId: 1, pairAId: getP('A', 1), pairBId: getP('C', 2), scoreA: null, scoreB: null, isFinished: false });
    matches.push({ id: `qf-m-2`, round: 5, phase: 'qf', bracket: 'main', courtId: 2, pairAId: getP('C', 1), pairBId: getP('A', 2), scoreA: null, scoreB: null, isFinished: false });
    matches.push({ id: `qf-m-3`, round: 5, phase: 'qf', bracket: 'main', courtId: 3, pairAId: getP('B', 1), pairBId: getP('D', 2), scoreA: null, scoreB: null, isFinished: false });
    matches.push({ id: `qf-m-4`, round: 5, phase: 'qf', bracket: 'main', courtId: 4, pairAId: getP('D', 1), pairBId: getP('B', 2), scoreA: null, scoreB: null, isFinished: false });

    // QF Consolation (Round 5)
    matches.push({ id: `qf-c-1`, round: 5, phase: 'qf', bracket: 'consolation', courtId: 5, pairAId: getP('A', 3), pairBId: getP('C', 4), scoreA: null, scoreB: null, isFinished: false });
    matches.push({ id: `qf-c-2`, round: 5, phase: 'qf', bracket: 'consolation', courtId: 6, pairAId: getP('C', 3), pairBId: getP('A', 4), scoreA: null, scoreB: null, isFinished: false });
    matches.push({ id: `qf-c-3`, round: 5, phase: 'qf', bracket: 'consolation', courtId: 1, pairAId: getP('B', 3), pairBId: getP('D', 4), scoreA: null, scoreB: null, isFinished: false });
    matches.push({ id: `qf-c-4`, round: 5, phase: 'qf', bracket: 'consolation', courtId: 2, pairAId: getP('D', 3), pairBId: getP('B', 4), scoreA: null, scoreB: null, isFinished: false });

    return matches;
};

const generateDemoData = (): TournamentState => {
    const players: Player[] = [];
    const pairs: Pair[] = [];
    
    const firstNames = ['Juan', 'Pedro', 'Luis', 'Carlos', 'Ana', 'Maria', 'Lucia', 'Sofia', 'Diego', 'Javier', 'Miguel', 'Jose'];
    const lastNames = ['Garcia', 'Lopez', 'Perez', 'Rodriguez', 'Martinez', 'Sanchez', 'Fernandez', 'Gomez'];
    
    for (let i = 1; i <= 40; i++) {
        const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
        
        // Assign 1 or 2 random categories
        const numCats = Math.random() > 0.8 ? 2 : 1;
        const pCats: string[] = [];
        for(let j=0; j<numCats; j++) {
            const randCat = TOURNAMENT_CATEGORIES[Math.floor(Math.random() * TOURNAMENT_CATEGORIES.length)];
            if(!pCats.includes(randCat)) pCats.push(randCat);
        }

        players.push({
            id: `demo-p-${i}`,
            name: name,
            nickname: `J${i}`,
            categories: pCats,
            paid: Math.random() > 0.2,
            saveRecord: false
        });
    }

    // Create 16 Main Pairs
    for (let i = 0; i < 16; i++) {
        pairs.push({
            id: `pair-${i + 1}`,
            player1Id: players[i * 2].id,
            player2Id: players[i * 2 + 1].id,
            name: `Pareja ${i + 1}`,
            waterReceived: Math.random() > 0.5,
            stats: { played: 0, won: 0, gameDiff: 0 },
            isReserve: false
        });
    }
    
    // Create 2 Reserve Pairs
    for (let i = 16; i < 18; i++) {
         pairs.push({
            id: `pair-res-${i + 1}`,
            player1Id: players[i * 2].id,
            player2Id: players[i * 2 + 1].id,
            name: `Reserva ${i - 15}`,
            waterReceived: false,
            stats: { played: 0, won: 0, gameDiff: 0 },
            isReserve: true
        });
    }

    const groups = generateGroups(pairs);
    
    const pairsWithGroups = pairs.map(p => {
        const g = groups.find(grp => grp.pairIds.includes(p.id));
        return { ...p, groupId: g?.id };
    });

    const matches = generateGroupMatches(groups);

    return {
        status: 'active',
        currentRound: 1,
        players,
        pairs: pairsWithGroups,
        matches,
        groups,
        courts: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, ballsGiven: Math.random() > 0.5 })),
        startDate: new Date().toISOString()
    };
};


const reducer = (state: TournamentState, action: TournamentAction): TournamentState => {
  switch (action.type) {
    case 'LOAD_FROM_STORAGE':
        return action.payload;

    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, action.payload] };

    case 'UPDATE_PLAYER':
      return {
          ...state,
          players: state.players.map(p => p.id === action.payload.id ? action.payload : p)
      };
      
    case 'CREATE_PAIR':
      const isReserve = state.pairs.length >= 16;
      const newPair: Pair = {
        id: `pair-${Date.now()}`,
        player1Id: action.payload.player1Id,
        player2Id: action.payload.player2Id,
        name: action.payload.name || `Pareja ${state.pairs.length + 1}`,
        waterReceived: false,
        stats: { played: 0, won: 0, gameDiff: 0 },
        isReserve
      };
      return { ...state, pairs: [...state.pairs, newPair] };
      
    case 'UPDATE_PAIR':
        return {
            ...state,
            pairs: state.pairs.map(p => 
                p.id === action.payload.pairId 
                ? { ...p, player1Id: action.payload.player1Id, player2Id: action.payload.player2Id }
                : p
            )
        };
    
    case 'DELETE_PAIR':
        const pairToDelete = state.pairs.find(p => p.id === action.payload);
        if(!pairToDelete) return state;
        
        let newPairs = state.pairs.filter(p => p.id !== action.payload);
        
        // Logic: If we deleted a main pair, move the first reserve to main
        if (!pairToDelete.isReserve) {
            const firstReserveIndex = newPairs.findIndex(p => p.isReserve);
            if (firstReserveIndex !== -1) {
                const promotedReserve = { ...newPairs[firstReserveIndex], isReserve: false };
                newPairs[firstReserveIndex] = promotedReserve;
            }
        }
        
        return { ...state, pairs: newPairs };

    case 'TOGGLE_PAID':
      return {
        ...state,
        players: state.players.map(p => p.id === action.payload ? { ...p, paid: !p.paid } : p)
      };

    case 'TOGGLE_WATER':
      return {
        ...state,
        pairs: state.pairs.map(p => p.id === action.payload ? { ...p, waterReceived: !p.waterReceived } : p)
      };

    case 'TOGGLE_BALLS':
        return {
            ...state,
            courts: state.courts.map(c => c.id === action.payload ? { ...c, ballsGiven: !c.ballsGiven } : c)
        };

    case 'START_TOURNAMENT':
        // Filter only active pairs for groups
        const activePairs = state.pairs.filter(p => !p.isReserve);
        if (activePairs.length < 16) {
            alert("Necesitas 16 parejas titulares para empezar.");
            return state;
        } 
        
        const groups = generateGroups(state.pairs);
        
        const pairsWithGroups = state.pairs.map(p => {
            const g = groups.find(grp => grp.pairIds.includes(p.id));
            return { ...p, groupId: g?.id };
        });

        const matches = generateGroupMatches(groups);

        return {
            ...state,
            status: 'active',
            currentRound: 1,
            groups,
            pairs: pairsWithGroups,
            matches,
            startDate: new Date().toISOString()
        };

    case 'UPDATE_SCORE':
        return {
            ...state,
            matches: state.matches.map(m => m.id === action.payload.matchId ? {
                ...m,
                scoreA: action.payload.scoreA,
                scoreB: action.payload.scoreB,
                isFinished: true
            } : m)
        };

    case 'NEXT_ROUND':
        if (state.currentRound < 4) {
            return { ...state, currentRound: state.currentRound + 1 };
        } else if (state.currentRound === 4) {
            // Generate Playoffs (QF)
            const { updatedPairs, groupRankings } = calculateRankings(state.pairs, state.matches, state.groups);
            const playoffMatches = generatePlayoffMatches(groupRankings);
            
            return {
                ...state,
                currentRound: 5, 
                pairs: updatedPairs,
                matches: [...state.matches, ...playoffMatches]
            };
        } else if (state.currentRound >= 5) {
            // Generate SF and Finals Logic
            const currentMatches = state.matches.filter(m => m.round === state.currentRound);
            if (currentMatches.some(m => !m.isFinished)) {
                alert("Todos los partidos deben terminar antes de avanzar.");
                return state;
            }
            
            const nextRound = state.currentRound + 1;
            const newMatches: Match[] = [];
            
            const getWinner = (idPartial: string) => {
                 const m = currentMatches.find(m => m.id.includes(idPartial));
                 if (!m || m.scoreA === null || m.scoreB === null) return null;
                 return m.scoreA > m.scoreB ? m.pairAId : m.pairBId;
            }

            // If moving from QF (5) to SF (6)
            if (state.currentRound === 5) {
                 // SF Main
                 const winQF_M1 = getWinner('qf-m-1');
                 const winQF_M2 = getWinner('qf-m-2');
                 const winQF_M3 = getWinner('qf-m-3');
                 const winQF_M4 = getWinner('qf-m-4');

                 if(winQF_M1 && winQF_M2) newMatches.push({ id: 'sf-m-1', round: 6, phase: 'sf', bracket: 'main', courtId: 1, pairAId: winQF_M1, pairBId: winQF_M2, scoreA: null, scoreB: null, isFinished: false });
                 if(winQF_M3 && winQF_M4) newMatches.push({ id: 'sf-m-2', round: 6, phase: 'sf', bracket: 'main', courtId: 2, pairAId: winQF_M3, pairBId: winQF_M4, scoreA: null, scoreB: null, isFinished: false });
                 
                 // SF Consolation
                 const winQF_C1 = getWinner('qf-c-1');
                 const winQF_C2 = getWinner('qf-c-2');
                 const winQF_C3 = getWinner('qf-c-3');
                 const winQF_C4 = getWinner('qf-c-4');

                 if(winQF_C1 && winQF_C2) newMatches.push({ id: 'sf-c-1', round: 6, phase: 'sf', bracket: 'consolation', courtId: 3, pairAId: winQF_C1, pairBId: winQF_C2, scoreA: null, scoreB: null, isFinished: false });
                 if(winQF_C3 && winQF_C4) newMatches.push({ id: 'sf-c-2', round: 6, phase: 'sf', bracket: 'consolation', courtId: 4, pairAId: winQF_C3, pairBId: winQF_C4, scoreA: null, scoreB: null, isFinished: false });

            } else if (state.currentRound === 6) {
                 // Moving from SF (6) to Final (7)
                 const winSF_M1 = getWinner('sf-m-1');
                 const winSF_M2 = getWinner('sf-m-2');
                 if(winSF_M1 && winSF_M2) newMatches.push({ id: 'final-m', round: 7, phase: 'final', bracket: 'main', courtId: 1, pairAId: winSF_M1, pairBId: winSF_M2, scoreA: null, scoreB: null, isFinished: false });

                 const winSF_C1 = getWinner('sf-c-1');
                 const winSF_C2 = getWinner('sf-c-2');
                 if(winSF_C1 && winSF_C2) newMatches.push({ id: 'final-c', round: 7, phase: 'final', bracket: 'consolation', courtId: 2, pairAId: winSF_C1, pairBId: winSF_C2, scoreA: null, scoreB: null, isFinished: false });
            } else if (state.currentRound === 7) {
                 // Mark as Finished
                 return { ...state, status: 'finished' };
            }

            return { ...state, currentRound: nextRound, matches: [...state.matches, ...newMatches] };
        } else {
            return state;
        }

    case 'RESET_TOURNAMENT':
        localStorage.removeItem(STORAGE_KEY);
        return initialState;
    
    case 'LOAD_DEMO_DATA':
        return generateDemoData();

    default:
      return state;
  }
};

const TournamentContext = createContext<{
  state: TournamentState;
  dispatch: React.Dispatch<TournamentAction>;
}>({ state: initialState, dispatch: () => null });

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load from LocalStorage on mount
  useEffect(() => {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
          try {
              const parsedData = JSON.parse(savedData);
              dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsedData });
          } catch (e) {
              console.error("Failed to load tournament data", e);
          }
      }
  }, []);

  // Save to LocalStorage on state change
  useEffect(() => {
      if (state !== initialState) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
  }, [state]);
  
  return (
    <TournamentContext.Provider value={{ state, dispatch }}>
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => useContext(TournamentContext);
