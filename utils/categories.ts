/**
 * Categorías canónicas de pádel — fuente única de verdad.
 * Formato almacenado en BD: '1ª CAT', '2ª CAT', ... 'Iniciación'
 * Orden: de mayor a menor nivel (1ª es el más alto).
 */
export const PADEL_CATEGORIES = [
  '1ª CAT',
  '2ª CAT',
  '3ª CAT',
  '4ª CAT',
  '5ª CAT',
  'Iniciación',
] as const;

export type PadelCategory = typeof PADEL_CATEGORIES[number];

/** Etiqueta corta para pills/chips */
export const CATEGORY_SHORT: Record<PadelCategory, string> = {
  '1ª CAT':    '1ª',
  '2ª CAT':    '2ª',
  '3ª CAT':    '3ª',
  '4ª CAT':    '4ª',
  '5ª CAT':    '5ª',
  'Iniciación':'Iniciación',
};

/** Descripción larga para selects de onboarding */
export const CATEGORY_DESCRIPTION: Record<PadelCategory, string> = {
  '1ª CAT':    '1ª — Alta competición',
  '2ª CAT':    '2ª — Competición',
  '3ª CAT':    '3ª — Avanzado',
  '4ª CAT':    '4ª — Intermedio',
  '5ª CAT':    '5ª — Básico',
  'Iniciación':'Iniciación — Principiante',
};

/** Rango de ELO de cada categoría [min, max) */
export const CATEGORY_ELO_RANGE: Record<PadelCategory, [number, number]> = {
  '1ª CAT':    [5000, Infinity],
  '2ª CAT':    [4000, 5000],
  '3ª CAT':    [3000, 4000],
  '4ª CAT':    [2000, 3000],
  '5ª CAT':    [1000, 2000],
  'Iniciación': [0,   1000],
};

/** Devuelve la categoría real de un jugador según su ELO */
export function categoryFromElo(elo: number): PadelCategory {
  for (const cat of PADEL_CATEGORIES) {
    const [min, max] = CATEGORY_ELO_RANGE[cat];
    if (elo >= min && elo < max) return cat;
  }
  return 'Iniciación';
}

/**
 * Niveles de partido (más granulares que categorías).
 * Usados en selects al crear partidos y torneos.
 */
export const MATCH_LEVELS = [
  'Abierto',
  'Iniciación',
  '5ª Categoría',
  '5ª Alta',
  '4ª Categoría',
  '4ª Alta',
  '3ª Categoría',
  '3ª Alta',
  '2ª Categoría',
  '1ª Categoría',
] as const;

export type MatchLevel = typeof MATCH_LEVELS[number];
