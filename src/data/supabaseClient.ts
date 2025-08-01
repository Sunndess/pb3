import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Use import.meta.env for Vite or similar bundlers
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zgmrhchehyqsdixizylu.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbXJoY2hlaHlxc2RpeGl6eWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTU3NzYsImV4cCI6MjA2MDk5MTc3Nn0.TOjnPnCASrfNradzGlqe4uCrhGLlhudB8jDz_0xVGfI';

let supabaseInstance: SupabaseClient | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
})();

