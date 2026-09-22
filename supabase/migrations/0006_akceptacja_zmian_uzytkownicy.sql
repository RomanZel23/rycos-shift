-- ============================================================================
-- RYCOS Shift — Rejestr zmian w projekcie, etap 1: kompetencja akceptującego
-- ----------------------------------------------------------------------------
-- Uruchomić ręcznie w Supabase SQL Editor, PO migracjach 0001–0005.
--
-- Co robi:
--   1. Dodaje do users kompetencję „Akceptacja zmian w projekcie"
--      (can_accept_changes) i adres e-mail, na który idą karty zmian.
--   2. Pilnuje w bazie, że akceptujący MA adres — panel sprawdza to też,
--      ale ograniczenie w bazie nie da się obejść starym klientem.
--
-- Migracja jest addytywna: nie zmienia ani nie kasuje żadnych istniejących
-- danych. Obecna wersja aplikacji działa z nią bez zmian (nowych kolumn nie
-- czyta), więc można ją uruchomić PRZED wdrożeniem nowego kodu.
-- ============================================================================

begin;

alter table public.users
  add column if not exists can_accept_changes boolean not null default false,
  add column if not exists email              text;

-- Adres zapisujemy znormalizowany (małe litery, bez spacji) — tak robi serwer.
alter table public.users
  drop constraint if exists users_email_format;
alter table public.users
  add constraint users_email_format
  check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$');

alter table public.users
  drop constraint if exists users_acceptor_has_email;
alter table public.users
  add constraint users_acceptor_has_email
  check (not can_accept_changes or email is not null);

commit;

-- ============================================================================
-- WERYFIKACJA
-- ============================================================================
-- 1. Kolumny istnieją:
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'users'
--      and column_name in ('can_accept_changes', 'email');
--
-- 2. Na starcie nikt nie ma kompetencji (oczekiwane: 0):
--   select count(*) from public.users where can_accept_changes;
-- ============================================================================
