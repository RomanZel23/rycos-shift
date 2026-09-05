-- ============================================================================
-- RYCOS Shift — Etap 0: zamknięcie publicznego dostępu do bazy i Storage
-- ----------------------------------------------------------------------------
-- Uruchomić w Supabase SQL Editor (rola postgres) LUB przez supabase db push.
--
-- Co robi:
--   1. Usuwa polityki RLS typu `USING (true)`, które dawały roli anon pełny
--      odczyt i zapis wszystkich tabel (łącznie z users i hasłami).
--   2. Wymusza RLS i odbiera role anon/authenticated granty tabelowe,
--      przez co jedyną drogą do danych zostaje serwer aplikacji
--      działający na service_role (który omija RLS).
--   3. Przełącza bucket rycos-reports na prywatny i kasuje otwarte polityki
--      Storage. Pliki serwuje odtąd endpoint /api/files (za bramką dostępu).
--
-- UWAGA: po tej migracji klucz anon przestaje cokolwiek dawać. Aplikacja
-- korzysta z SUPABASE_SERVICE_ROLE_KEY wyłącznie po stronie serwera.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Usunięcie w pełni otwartych polityk RLS
-- ---------------------------------------------------------------------------
drop policy if exists "Allow anon read/write users"     on public.users;
drop policy if exists "Allow anon read/write sites"     on public.construction_sites;
drop policy if exists "Allow anon read/write topics"    on public.topic_templates;
drop policy if exists "Allow anon read/write reports"   on public.daily_reports;
drop policy if exists "Allow anon read/write settings"  on public.tenant_settings;
drop policy if exists "Allow anon read/write templates" on public.pdf_templates;

-- ---------------------------------------------------------------------------
-- 2. RLS włączone i wymuszone. Brak jakiejkolwiek polityki = domyślny DENY.
--    service_role ma atrybut BYPASSRLS, więc serwer aplikacji działa dalej.
-- ---------------------------------------------------------------------------
alter table public.users              enable row level security;
alter table public.construction_sites enable row level security;
alter table public.topic_templates    enable row level security;
alter table public.daily_reports      enable row level security;
alter table public.tenant_settings    enable row level security;
alter table public.pdf_templates      enable row level security;

alter table public.users              force row level security;
alter table public.construction_sites force row level security;
alter table public.topic_templates    force row level security;
alter table public.daily_reports      force row level security;
alter table public.tenant_settings    force row level security;
alter table public.pdf_templates      force row level security;

-- ---------------------------------------------------------------------------
-- 3. Odebranie grantów tabelowych rolom publicznym (pas i szelki obok RLS)
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Dotyczy obiektów tworzonych w przyszłości przez rolę wykonującą tę migrację.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Bucket rycos-reports: prywatny, bez otwartych polityk
-- ---------------------------------------------------------------------------
update storage.buckets set public = false where id = 'rycos-reports';

drop policy if exists "Public Access for rycos-reports" on storage.objects;
drop policy if exists "Allow Upload to rycos-reports"   on storage.objects;
drop policy if exists "Allow Update in rycos-reports"   on storage.objects;

commit;

-- ============================================================================
-- WERYFIKACJA — uruchomić po migracji, każde zapytanie powinno dać pustkę/false
-- ============================================================================

-- 4a. Żadna tabela nie powinna mieć polityki bez warunku:
--   select schemaname, tablename, policyname, qual
--   from pg_policies
--   where schemaname in ('public','storage')
--     and (qual = 'true' or qual is null);

-- 4b. Bucket musi być prywatny:
--   select id, public from storage.buckets where id = 'rycos-reports';

-- 4c. anon nie może mieć żadnych uprawnień do tabel aplikacji:
--   select table_name, privilege_type
--   from information_schema.role_table_grants
--   where grantee = 'anon' and table_schema = 'public';

-- ============================================================================
-- OPCJONALNIE (Etap 1 i tak wymieni logowanie na Supabase Auth):
-- wyzerowanie zaseedowanych haseł plaintext 'password123'
-- ============================================================================
--   update public.users set password = null where password = 'password123';
