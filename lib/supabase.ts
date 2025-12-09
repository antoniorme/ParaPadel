
import { createClient } from '@supabase/supabase-js';

// Intentamos obtener las variables de forma segura sin funciones auxiliares complejas
let supabaseUrl = 'https://placeholder.supabase.co';
let supabaseKey = 'placeholder';

try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_SUPABASE_URL) supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // @ts-ignore
    if (import.meta.env.VITE_SUPABASE_ANON_KEY) supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }
} catch (e) {
  console.warn("No se pudieron leer las variables de entorno de Vite.");
}

// Inicialización segura del cliente
export const supabase = createClient(supabaseUrl, supabaseKey);
