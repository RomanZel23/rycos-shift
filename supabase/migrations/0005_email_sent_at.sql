-- ============================================================================
-- RYCOS Shift — Etap 4: data i godzina wysyłki maila
-- ----------------------------------------------------------------------------
-- Uruchomić ręcznie w Supabase SQL Editor, PO migracjach 0001–0004.
--
-- Kontekst: archiwum pokazywało „Wysłano e-mail" bez żadnego znacznika czasu.
-- Przy sporze o to, kiedy dokumentacja dotarła do kierownictwa, jedynym
-- dowodem był panel Resend — czyli usługa zewnętrzna z własnym okresem
-- przechowywania. Nowa kolumna trzyma ten moment w naszej bazie.
--
-- Kolumna jest ODDZIELNA od sent_at. sent_at to chwila złożenia raportu przez
-- pracownika w terenie; email_sent_at to chwila, w której Resend przyjął
-- wiadomość. Zwykle dzielą je sekundy, ale przy raporcie dosłanym po utracie
-- łączności albo wysłanym ponownie z Archiwum to dwie różne daty i mieszanie
-- ich w jednej kolumnie zacierałoby właśnie ten przypadek.
-- ============================================================================

begin;

alter table public.reports
  add column if not exists email_sent_at timestamptz;

comment on column public.reports.email_sent_at is
  'Moment przyjęcia wiadomości przez Resend. NULL = mail nigdy nie poszedł. '
  'Przy ponownej wysyłce z Archiwum nadpisywane datą ostatniej udanej wysyłki.';

-- Backfill dla raportów historycznych.
--
-- Dla wierszy ze statusem SENT bierzemy sent_at. Jest to uczciwe przybliżenie:
-- w dotychczasowym przepływie zapis wiersza i wysyłka maila działy się w tym
-- samym żądaniu, a przy ponownej wysyłce z Archiwum sent_at i tak było
-- nadpisywane momentem tej wysyłki. Rozbieżność liczy się w sekundach.
--
-- Wiersze ze statusem EMAIL_FAILED, FAILED i SAVED_LOCAL zostają z NULL —
-- dla nich mail nie poszedł i wpisanie tam jakiejkolwiek daty byłoby zmyśleniem.
update public.reports
   set email_sent_at = sent_at
 where email_sent_at is null
   and status = 'SENT'
   and sent_at is not null;

-- Wyszukiwanie „co poszło mailem w danym tygodniu".
create index if not exists reports_email_sent_at_idx
  on public.reports (email_sent_at desc nulls last);

commit;

-- ============================================================================
-- WERYFIKACJA
-- ============================================================================

-- 1. Kolumna istnieje:
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'reports'
--     and column_name = 'email_sent_at';

-- 2. Ile raportów ma datę wysyłki, w rozbiciu na status.
--    Oczekiwane: SENT ma komplet, pozostałe statusy mają same NULL-e.
--   select status,
--          count(*) as razem,
--          count(email_sent_at) as z_data_wysylki
--     from public.reports
--    group by status
--    order by status;

-- 3. Podgląd ostatnich raportów — sent_at obok email_sent_at:
--   select report_date, report_time, status, sent_at, email_sent_at
--     from public.reports
--    order by report_date desc, report_time desc
--    limit 10;
