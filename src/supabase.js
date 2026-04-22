import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (url && key) ? createClient(url, key) : null;
export const ARROW_TABLE = 'arrow_offsets';
export const BUDGET_TABLE = 'budget_state';

if (!supabase && typeof window !== 'undefined') {
  console.warn('[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Arrow tweaks will not persist.');
}
