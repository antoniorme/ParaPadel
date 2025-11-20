import { createClient } from '@supabase/supabase-js';

// Helper function to safely retrieve environment variables across different environments
const getEnv = (key: string, fallbackKey: string = '') => {
  // Try import.meta.env (Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
       // @ts-ignore
       const val = import.meta.env[key];
       if (val) return val;
    }
  } catch (e) {}

  // Try process.env (Node/CRA)
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[key]) return process.env[key];
      if (fallbackKey && process.env[fallbackKey]) return process.env[fallbackKey];
    }
  } catch (e) {}

  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Authentication will fail.');
}

// Initialize client with fallback values to prevent immediate crash if config is missing
// We use a placeholder URL to ensure the supabase client is always instantiated,
// preventing "cannot read property of undefined" errors when importing 'supabase' elsewhere.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);