
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[ParaPádel] Faltan variables de entorno de Supabase.\n' +
    'Crea un fichero .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.\n' +
    'Ver .env.example para referencia.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
