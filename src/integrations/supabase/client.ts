/**
 * Supabase Client - PROD-safe
 *
 * In production, the client must be configured via environment variables.
 * If not configured, throw explicit errors instead of silently returning mock data.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const createDisabledClient = (): SupabaseClient => {
  const handler = {
    get() {
      throw new Error('Supabase client is not configured for this environment.');
    }
  };
  return new Proxy({}, handler) as SupabaseClient;
};

export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : createDisabledClient();

if (!isConfigured && typeof window !== 'undefined') {
  console.warn('[מגן דוד] Supabase is not configured. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}
