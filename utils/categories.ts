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
