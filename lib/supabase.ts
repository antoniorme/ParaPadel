
import { createClient } from '@supabase/supabase-js';

// Inicialización de Supabase con verificación de seguridad.
// Usamos (import.meta.env && import.meta.env.VARIABLE) para evitar crashes si env es undefined.
// Vite reemplazará la segunda parte de la expresión con el valor real durante el build.

// @ts-ignore
const supabaseUrl = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://placeholder.supabase.co';
// @ts-ignore
const supabaseKey = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);
