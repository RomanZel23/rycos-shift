import { createClient } from "@supabase/supabase-js";

/**
 * UWAGA: ten moduł jest przeznaczony WYŁĄCZNIE dla kodu serwerowego
 * (route handlers, proxy). Używa SUPABASE_SERVICE_ROLE_KEY, który omija RLS.
 * Nie importować go z komponentów klienckich.
 *
 * Etap 4 rozdzieli go na supabase-server.ts / supabase-browser.ts.
 */

const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ""
).trim();

const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ""
).trim();

export const isSupabaseConfigured = () =>
  Boolean(supabaseUrl && supabaseUrl.startsWith("http") && supabaseKey.length > 10);

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
};
