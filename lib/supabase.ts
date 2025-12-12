
import { createClient } from '@supabase/supabase-js';

// Inicialización de Supabase con patrón de acceso seguro + reemplazo estático
// Usamos try-catch para acceder a import.meta.env.VARIABLE explícitamente.
// Esto permite que Vite reemplace la variable durante el build, pero evita el crash si env es undefined en runtime.

let supabaseUrl = 'https://placeholder.supabase.co';
let supabaseKey = 'placeholder';

try {
    // @ts-ignore
    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    // @ts-ignore
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (envUrl && typeof envUrl === 'string' && envKey && typeof envKey === 'string') {
        supabaseUrl = envUrl;
        supabaseKey = envKey;
    }
} catch (e) {
    // Si import.meta.env falla, mantenemos los valores placeholder
    console.warn("Supabase Env access error, using placeholders.");
}

// Inicialización del cliente
export const supabase = createClient(supabaseUrl, supabaseKey);
