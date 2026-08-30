import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://nippewqmdgcjdeftvmdz.supabase.co";

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export const isSupabaseConfigured = () => Boolean(supabaseKey && supabaseKey.length > 10);

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
};
