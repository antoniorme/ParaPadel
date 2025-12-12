
import { createClient } from '@supabase/supabase-js';

// Inicialización Robusta de Supabase
// Usamos try-catch para permitir que Vite realice el reemplazo estático de strings durante el build
// PERO capturamos cualquier error en tiempo de ejecución si import.meta.env no está definido.

let supabaseUrl = 'https://placeholder.supabase.co';
let supabaseKey = 'placeholder';

try {
    // Vite buscará y reemplazará estas cadenas exactas.
    // Si no las reemplaza y env es undefined, saltará al catch sin romper la app.
    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (envUrl && typeof envUrl === 'string') supabaseUrl = envUrl;
    if (envKey && typeof envKey === 'string') supabaseKey = envKey;
} catch (error) {
    console.warn('Supabase env vars not detected, running in placeholder mode.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
