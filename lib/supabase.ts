
import { createClient } from '@supabase/supabase-js';

// Inicialización de Supabase
// Usamos short-circuit (&&) para asegurar que import.meta.env existe antes de acceder.
// Esto permite que Vite reemplace las variables estáticamente sin romper la ejecución si env es undefined.

let supabaseUrl = 'https://placeholder.supabase.co';
let supabaseKey = 'placeholder';

// @ts-ignore
const envUrl = import.meta.env && import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const envKey = import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY;

if (envUrl && typeof envUrl === 'string' && envKey && typeof envKey === 'string') {
    supabaseUrl = envUrl;
    supabaseKey = envKey;
}

// Inicialización del cliente
export const supabase = createClient(supabaseUrl, supabaseKey);
