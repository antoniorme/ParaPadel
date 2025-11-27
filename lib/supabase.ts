import { createClient } from '@supabase/supabase-js';

// Helper function to safely retrieve environment variables
const getEnv = (key: string) => {
  // Try import.meta.env (Vite standard)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
       // @ts-ignore
       const val = import.meta.env[key];
       if (val) return val;
    }
  } catch (e) {}

  // Try process.env (Node/CRA fallback)
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {}

  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  // This will appear in the browser console if Vercel env vars are missing
  console.error(
    'CRITICAL ERROR: Supabase configuration is missing.\n' +
    'Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel Environment Variables.'
  );
}

// Initialize client strictly. 
// If url/key are undefined, createClient might throw, alerting the developer immediately instead of failing silently.
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseKey || ''
);
