-- ============================================================================
-- RYCOS Shift — Etap 2: uczciwy status wysyłki i ślad autorstwa raportu
-- ----------------------------------------------------------------------------
-- Uruchomić ręcznie w Supabase SQL Editor, PO migracjach 0001 i 0002.
--
-- Kontekst: do tej pory każdy raport lądował w bazie ze statusem 'SENT',
-- niezależnie od tego, czy mail faktycznie poszedł. Nowy przepływ
-- (/api/reports) zapisuje prawdziwy wynik wysyłki i powód niepowodzenia.
-- ============================================================================

begin;

alter table public.daily_reports
  -- 'SENT' | 'EMAIL_FAILED' | 'SAVED_LOCAL' | 'FAILED'
  add column if not exists error_message   text,
  -- Kto złożył raport — brane z sesji, nie z ciała żądania.
  add column if not exists created_by      text,
  add column if not exists created_by_name text;

-- Szybsze filtrowanie archiwum po nieudanych wysyłkach.
create index if not exists daily_reports_status_idx
  on public.daily_reports (status);

create index if not exists daily_reports_date_idx
  on public.daily_reports (date desc);

commit;

-- ============================================================================
-- WERYFIKACJA
-- ============================================================================

-- 1. Nowe kolumny istnieją:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'daily_reports'
--     and column_name in ('error_message','created_by','created_by_name');

-- 2. Rozkład statusów — po wdrożeniu nowe raporty powinny mieć SENT
--    albo EMAIL_FAILED, historyczne zostaną przy SENT:
--   select status, count(*) from public.daily_reports group by status;
