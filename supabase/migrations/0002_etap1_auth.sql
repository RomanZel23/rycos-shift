-- ============================================================================
-- RYCOS Shift — Etap 1: prawdziwa autentykacja użytkowników
-- ----------------------------------------------------------------------------
-- Uruchomić ręcznie w Supabase SQL Editor, PO migracji 0001.
--
-- Co robi:
--   1. Dodaje kolumny na hashe hasła i PIN-u, licznik nieudanych prób,
--      blokadę czasową i epokę sesji.
--   2. Kasuje kolumnę `password` z hasłami plaintext.
--   3. Ustawia konto startowe administratora (Marcin Bajda / m.bajda), żeby
--      po wdrożeniu było się czym zalogować i nadać hasła reszcie zespołu.
--
-- Po tej migracji WSZYSCY POZOSTALI UŻYTKOWNICY NIE MAJĄ HASŁA i nie zalogują
-- się, dopóki administrator nie nada im hasła lub PIN-u w panelu Ustawienia.
-- Tak było ustalone: hasła nadaje administrator.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Nowe kolumny
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists password_hash          text,
  add column if not exists pin_hash               text,
  add column if not exists failed_login_attempts  integer     not null default 0,
  add column if not exists locked_until           timestamptz,
  add column if not exists last_login_at          timestamptz,
  -- Podniesienie epoki unieważnia wszystkie wydane ciasteczka sesji
  -- (zmiana hasła, zmiana PIN-u, odebranie uprawnień, „wyloguj wszędzie").
  add column if not exists session_epoch          integer     not null default 1;

-- Login musi być jednoznaczny — to on identyfikuje konto przy logowaniu.
create unique index if not exists users_login_unique
  on public.users (lower(login))
  where login is not null;

-- ---------------------------------------------------------------------------
-- 2. Konto startowe administratora
--    Hash scrypt hasła startowego użytego przy wdrożeniu 2026-09-05.
--    Hasło zostało zmienione zaraz po pierwszym zalogowaniu — ten hash jest
--    już tylko zapisem historycznym migracji. Przy odtwarzaniu środowiska
--    od zera wygeneruj nowy (instrukcja w docs/ETAP-1-RUNBOOK.md).
-- ---------------------------------------------------------------------------
update public.users
set password_hash = 'scrypt$65536$8$1$I8yDqCsQgc2gpfz5BRzQfw==$KCXHJJtJRgYCzLFVMy9XfZ19FIp3V9RwFTnIbzh+n+c=',
    failed_login_attempts = 0,
    locked_until = null,
    session_epoch = session_epoch + 1
where id = 'usr-admin-1';

-- Gdyby konto usr-admin-1 nie istniało (inne id po edycjach), spróbuj po loginie.
update public.users
set password_hash = 'scrypt$65536$8$1$I8yDqCsQgc2gpfz5BRzQfw==$KCXHJJtJRgYCzLFVMy9XfZ19FIp3V9RwFTnIbzh+n+c=',
    failed_login_attempts = 0,
    locked_until = null,
    session_epoch = session_epoch + 1
where lower(login) = 'm.bajda'
  and password_hash is null;

-- ---------------------------------------------------------------------------
-- 3. Koniec z hasłami plaintext
-- ---------------------------------------------------------------------------
alter table public.users drop column if exists password;

commit;

-- ============================================================================
-- WERYFIKACJA
-- ============================================================================

-- 3a. Kolumny `password` już nie ma, są nowe:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'users'
--   order by column_name;

-- 3b. Dokładnie jedno konto ma ustawione hasło (administrator):
--   select login, is_admin,
--          password_hash is not null as ma_haslo,
--          pin_hash      is not null as ma_pin
--   from public.users
--   order by is_admin desc, login;

-- 3c. Brak duplikatów loginu (inaczej indeks unikalny nie powstał):
--   select lower(login), count(*)
--   from public.users
--   where login is not null
--   group by 1 having count(*) > 1;
