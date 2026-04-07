/**
 * Supabase Client - DISABLED FOR ON-PREMISE DEPLOYMENT
 * 
 * This file provides a mock client that disables all external Supabase calls.
 * For on-premise/air-gapped deployments, data is stored locally.
 */

// Disabled for on-premise deployment - no external connections
const SUPABASE_ENABLED = false;

// Mock client that returns empty/null for all operations
const mockSupabaseClient = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  }),
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signIn: () => Promise.resolve({ data: null, error: { message: 'Supabase disabled for on-premise' } }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      download: () => Promise.resolve({ data: null, error: null }),
      remove: () => Promise.resolve({ data: null, error: null }),
    }),
  },
  rpc: () => Promise.resolve({ data: null, error: null }),
};

// Export disabled client
export const supabase = mockSupabaseClient;

// Log warning in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.info('[מגן דוד] Supabase disabled - running in on-premise mode');
}