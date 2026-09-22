-- ============================================================================
-- RYCOS Shift — Rejestr zmian w projekcie (trzeci workflow)
-- ----------------------------------------------------------------------------
-- Uruchomić ręcznie w Supabase SQL Editor, PO migracji 0006.
--
-- Model:
--   project_changes           — karta zmiany (bieżąca wersja treści + status)
--   project_change_versions   — migawka treści każdej wysłanej wersji
--   project_change_decisions  — decyzja akceptującego dla danej wersji,
--                               z podpisem, komentarzem i tokenem linku z maila
--   project_change_counters   — licznik numerów ZM/RRRR/NNNN (per rok, globalnie)
--
-- Zasady, których pilnuje serwer (i częściowo baza):
--   - treść karty edytuje wyłącznie autor, i tylko dopóki nikt nie zaakceptował
--     (locked_at is null); każda edycja = nowa wersja: oczekujące decyzje starej
--     wersji dostają SUPERSEDED (ich linki wygasają), oddane zostają jako
--     historia, a akceptujący dostają nowe linki do nowej wersji;
--   - decyzja z podpisem jest ostateczna (nie da się jej zmienić);
--   - znaczniki czasu decyzji nadaje serwer aplikacji, nie telefon;
--   - w bazie leżą wyłącznie ścieżki w buckecie, nigdy base64 ani URL-e.
--
-- Migracja jest addytywna — nie dotyka istniejących tabel raportów.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Karty zmian
-- ---------------------------------------------------------------------------
create table if not exists public.project_changes (
  id                   text primary key,
  tenant_id            text not null default 'tenant-sb-tech-poznan',
  number_year          integer not null,
  number_seq           integer not null,
  number               text not null unique,
  site_id              text,
  site_name            text not null,
  location             jsonb not null default '{}'::jsonb,
  name                 text not null check (length(trim(name)) > 0),
  -- Sekcja „Jest"
  current_description  text not null default '',
  -- [{ id, path, takenAt, source, capturedAt }]
  current_photos       jsonb not null default '[]'::jsonb,
  -- Sekcja „Powinno być"
  target_description   text not null default '',
  target_photos        jsonb not null default '[]'::jsonb,
  -- „Konieczne KNA" — znacznik: zmiana wymaga rewizji całego projektu od początku
  kna_required         boolean not null default false,
  status               text not null default 'PENDING'
                         check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'DISPUTED')),
  version              integer not null default 1 check (version >= 1),
  author_id            text not null,
  author_name          text not null,
  pdf_path             text
                         check (pdf_path is null or
                                pdf_path ~ '^pdf/[A-Za-z0-9._-]{1,200}$'),
  created_at           timestamptz not null default now(),
  -- Pierwsze wysłanie karty — po nim sortuje się archiwum
  submitted_at         timestamptz not null default now(),
  -- Wysłanie bieżącej wersji
  version_sent_at      timestamptz not null default now(),
  -- Pierwsza akceptacja: od tej chwili treść jest zamrożona
  locked_at            timestamptz,
  -- Komplet decyzji dla bieżącej wersji
  completed_at         timestamptz,
  -- Wysłanie końcowego PDF-a do listy odbiorców z Ustawień
  final_email_sent_at  timestamptz,
  updated_at           timestamptz not null default now(),
  unique (number_year, number_seq)
);

create index if not exists project_changes_submitted_idx on public.project_changes (submitted_at desc);
create index if not exists project_changes_status_idx    on public.project_changes (status);
create index if not exists project_changes_author_idx    on public.project_changes (author_id);

-- ---------------------------------------------------------------------------
-- 2. Historia wersji treści
-- ---------------------------------------------------------------------------
create table if not exists public.project_change_versions (
  change_id   text not null references public.project_changes (id) on delete cascade,
  version     integer not null,
  -- Pełna treść karty w chwili wysłania tej wersji
  snapshot    jsonb not null,
  sent_at     timestamptz not null default now(),
  sent_by     text not null,
  primary key (change_id, version)
);

-- ---------------------------------------------------------------------------
-- 3. Decyzje akceptujących
-- ---------------------------------------------------------------------------
create table if not exists public.project_change_decisions (
  id                 text primary key,
  change_id          text not null references public.project_changes (id) on delete cascade,
  version            integer not null,
  acceptor_id        text not null,
  acceptor_name      text not null,
  acceptor_email     text not null,
  decision           text not null default 'PENDING'
                       check (decision in ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED')),
  comment            text,
  signature_path     text
                       check (signature_path is null or
                              signature_path ~ '^signatures/[A-Za-z0-9._-]{1,200}$'),
  decided_at         timestamptz,
  -- SHA-256 z tokenu linku w mailu; sam token nigdzie nie jest zapisywany
  token_hash         text unique,
  token_expires_at   timestamptz,
  email_sent_at      timestamptz,
  email_error        text,
  created_at         timestamptz not null default now(),
  unique (change_id, version, acceptor_id),
  -- Odrzucenie wymaga komentarza; decyzja wymaga podpisu i czasu
  check (decision <> 'REJECTED' or length(trim(coalesce(comment, ''))) > 0),
  check (decision not in ('ACCEPTED', 'REJECTED') or (signature_path is not null and decided_at is not null))
);

create index if not exists project_change_decisions_change_idx   on public.project_change_decisions (change_id, version);
create index if not exists project_change_decisions_acceptor_idx on public.project_change_decisions (acceptor_id, decision);

-- ---------------------------------------------------------------------------
-- 4. Numeracja ZM/RRRR/NNNN — atomowo, bez dziur przy równoległych wysyłkach
-- ---------------------------------------------------------------------------
create table if not exists public.project_change_counters (
  year      integer primary key,
  last_seq  integer not null default 0
);

create or replace function public.next_project_change_seq(p_year integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.project_change_counters as c (year, last_seq)
  values (p_year, 1)
  on conflict (year) do update set last_seq = c.last_seq + 1
  returning last_seq;
$$;

-- ---------------------------------------------------------------------------
-- 5. Ustawienia: odbiorcy końcowego PDF-a karty zmiany
-- ---------------------------------------------------------------------------
alter table public.tenant_settings
  add column if not exists change_email_recipients jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 6. Reżim z Etapu 0: brak polityk = brak dostępu dla anon; serwer = service_role
-- ---------------------------------------------------------------------------
alter table public.project_changes          enable row level security;
alter table public.project_change_versions  enable row level security;
alter table public.project_change_decisions enable row level security;
alter table public.project_change_counters  enable row level security;
alter table public.project_changes          force row level security;
alter table public.project_change_versions  force row level security;
alter table public.project_change_decisions force row level security;
alter table public.project_change_counters  force row level security;

revoke all on public.project_changes          from anon, authenticated;
revoke all on public.project_change_versions  from anon, authenticated;
revoke all on public.project_change_decisions from anon, authenticated;
revoke all on public.project_change_counters  from anon, authenticated;
revoke all on function public.next_project_change_seq(integer) from public, anon, authenticated;
grant execute on function public.next_project_change_seq(integer) to service_role;

commit;

-- ============================================================================
-- WERYFIKACJA
-- ============================================================================
-- 1. Tabele istnieją i mają włączone RLS:
--   select relname, relrowsecurity, relforcerowsecurity
--     from pg_class
--    where relname in ('project_changes','project_change_versions',
--                      'project_change_decisions','project_change_counters');
--
-- 2. Licznik działa (UWAGA: zużywa numer — uruchamiać tylko na teście,
--    albo cofnąć: update project_change_counters set last_seq = last_seq - 1 ...):
--   select public.next_project_change_seq(2099);
--   delete from public.project_change_counters where year = 2099;
--
-- 3. Anon nie ma dostępu (oczekiwany błąd permission denied, z kluczem anon):
--   select * from public.project_changes;
-- ============================================================================
