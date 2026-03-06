/**
 * Supabase Client Configuration
 * For JWT verification and authentication
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');

  const errorMsg = `[Supabase] Missing environment variables: ${missing.join(', ')}`;
  console.error(errorMsg);

  if (process.env.VERCEL) {
    // On Vercel, we can't throw at top level without crashing the whole function
    // but the client will fail later with a better message if we don't throw now
    console.warn('[Supabase] Application might crash during auth requests due to missing configuration');
  } else {
    throw new Error(errorMsg);
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
