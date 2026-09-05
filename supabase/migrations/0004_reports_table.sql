-- ============================================================================
-- RYCOS Shift — Etap 2b: nowa tabela public.reports
-- ----------------------------------------------------------------------------
-- Uruchomić ręcznie w Supabase SQL Editor, PO migracjach 0001–0003.
--
-- Po co: daily_reports pozwalała trzymać w pdf_data_url trzy różne rzeczy —
-- base64, publiczny URL CDN i ścieżkę aplikacji. Stąd wzięło się to, że kod
-- czytający jeden format nie widział raportów zapisanych w drugim. Nowa tabela
-- dopuszcza dokładnie jedną formę odwołania do pliku: ścieżkę w buckecie,
-- pilnowaną ograniczeniem CHECK. Baza nie pozwoli już zapisać URL-a ani base64.
--
-- Co jeszcze się zmienia:
--   date TEXT  -> report_date date
--   time TEXT  -> report_time time
--   status     -> CHECK na dozwolone wartości
--   attendance_list / photo_documentation -> stały kształt obiektów
--
-- daily_reports NIE jest kasowana. Zostaje jako kopia do czasu, aż nowa tabela
-- popracuje kilka dni. Usunięcie jest na końcu pliku, zakomentowane.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Pomocnik: ścieżka w buckecie z dowolnej historycznej formy odwołania.
--    Odpowiednik storagePathFromRef z src/lib/storage-paths.ts.
-- ---------------------------------------------------------------------------
create or replace function public.rycos_storage_path(ref text)
returns text
language sql
immutable
as $$
  select case
    when ref is null or ref = '' then null
    when ref like 'data:%' then null
    when position('/storage/v1/object/public/rycos-reports/' in ref) > 0 then
      split_part(
        substring(ref from position('/storage/v1/object/public/rycos-reports/' in ref)
                            + length('/storage/v1/object/public/rycos-reports/')),
        '?', 1)
    when position('/storage/v1/object/sign/rycos-reports/' in ref) > 0 then
      split_part(
        substring(ref from position('/storage/v1/object/sign/rycos-reports/' in ref)
                            + length('/storage/v1/object/sign/rycos-reports/')),
        '?', 1)
    when ref like '/api/files?path=%' then
      replace(replace(split_part(ref, 'path=', 2), '%2F', '/'), '%2f', '/')
    when ref ~ '^(pdf|photos|signatures)/' then ref
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Nowa tabela
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id                text primary key,
  tenant_id         text not null default 'tenant-sb-tech-poznan',
  report_type       text not null
                      check (report_type in ('START_SHIFT', 'END_SHIFT')),

  report_date       date not null,
  report_time       time not null,

  site_id           text,
  site_name         text not null,
  foreman_id        text,
  foreman_name      text not null,

  location          jsonb not null default '{}'::jsonb,
  discussed_topics  jsonb not null default '[]'::jsonb,

  -- [{ id, userId, userName, userRole, isForeman, signaturePath, signatureInline, signedAt }]
  attendance        jsonb not null default '[]'::jsonb,
  -- [{ id, path, inline, description, takenAt }]
  photos            jsonb not null default '[]'::jsonb,

  pdf_file_name     text not null,
  -- JEDYNY dozwolony format. Baza odrzuci URL i base64.
  pdf_path          text
                      check (pdf_path is null or
                             pdf_path ~ '^(pdf|photos|signatures)/[A-Za-z0-9._-]{1,200}$'),
  -- Tymczasowe: base64 z najstarszych raportów. Przenosi je do bucketu
  -- endpoint /api/admin/backfill-media, po czym kolumna zostaje pusta.
  legacy_pdf_base64 text,

  sent_to_emails    jsonb not null default '[]'::jsonb,
  sent_at           timestamptz,
  status            text not null default 'SENT'
                      check (status in ('SENT', 'EMAIL_FAILED', 'SAVED_LOCAL', 'FAILED', 'QUEUED')),
  error_message     text,

  created_by        text,
  created_by_name   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists reports_date_idx   on public.reports (report_date desc);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_site_idx   on public.reports (site_id);

-- Reżim z Etapu 0: brak polityk = brak dostępu dla anon; serwer chodzi na service_role.
alter table public.reports enable row level security;
alter table public.reports force  row level security;
revoke all on public.reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Przeniesienie danych z konwersją
-- ---------------------------------------------------------------------------
insert into public.reports (
  id, tenant_id, report_type, report_date, report_time,
  site_id, site_name, foreman_id, foreman_name,
  location, discussed_topics, attendance, photos,
  pdf_file_name, pdf_path, legacy_pdf_base64,
  sent_to_emails, sent_at, status, error_message,
  created_by, created_by_name, created_at
)
select
  d.id,
  coalesce(d.tenant_id, 'tenant-sb-tech-poznan'),
  d.report_type,
  nullif(trim(d.date), '')::date,
  nullif(trim(d.time), '')::time,
  d.site_id,
  coalesce(nullif(trim(d.site_name), ''), 'Nieznany plac'),
  d.foreman_id,
  coalesce(nullif(trim(d.foreman_name), ''), 'Nieznany brygadzista'),
  coalesce(d.location, '{}'::jsonb),
  coalesce(d.discussed_topics, '[]'::jsonb),

  -- lista obecności
  coalesce((
    select jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'id',              a ->> 'id',
               'userId',          a ->> 'userId',
               'userName',        a ->> 'userName',
               'userRole',        a ->> 'userRole',
               'isForeman',       coalesce((a ->> 'isForeman')::boolean, false),
               'signaturePath',   public.rycos_storage_path(a ->> 'signatureDataUrl'),
               'signatureInline', case when (a ->> 'signatureDataUrl') like 'data:%'
                                       then a ->> 'signatureDataUrl' end,
               'signedAt',        a ->> 'signedAt'
             ))
             order by ord)
    from jsonb_array_elements(coalesce(d.attendance_list, '[]'::jsonb)) with ordinality t(a, ord)
  ), '[]'::jsonb),

  -- fotorelacja
  coalesce((
    select jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'id',          p ->> 'id',
               'path',        public.rycos_storage_path(p ->> 'photoDataUrl'),
               'inline',      case when (p ->> 'photoDataUrl') like 'data:%'
                                   then p ->> 'photoDataUrl' end,
               'description', p ->> 'description',
               'takenAt',     p ->> 'takenAt'
             ))
             order by ord)
    from jsonb_array_elements(coalesce(d.photo_documentation, '[]'::jsonb)) with ordinality t(p, ord)
  ), '[]'::jsonb),

  coalesce(nullif(trim(d.pdf_file_name), ''), 'raport.pdf'),
  public.rycos_storage_path(d.pdf_data_url),
  case when d.pdf_data_url like 'data:%' then d.pdf_data_url end,

  coalesce(d.sent_to_emails, '[]'::jsonb),
  d.sent_at,
  case when d.status in ('SENT', 'EMAIL_FAILED', 'SAVED_LOCAL', 'FAILED', 'QUEUED')
       then d.status else 'SENT' end,
  d.error_message,
  d.created_by,
  d.created_by_name,
  d.created_at
from public.daily_reports d
on conflict (id) do nothing;

commit;

-- ============================================================================
-- WERYFIKACJA — uruchomić po migracji
-- ============================================================================

-- 4a. Tyle samo wierszy w obu tabelach:
--   select
--     (select count(*) from public.daily_reports) as stara,
--     (select count(*) from public.reports)       as nowa;

-- 4b. Każdy raport ma PDF: albo ścieżkę w buckecie, albo base64 do przeniesienia.
--     Kolumna "bez_pliku" MUSI być zerowa.
--   select
--     count(*) filter (where pdf_path is not null)          as w_buckecie,
--     count(*) filter (where legacy_pdf_base64 is not null) as do_przeniesienia,
--     count(*) filter (where pdf_path is null
--                        and legacy_pdf_base64 is null)     as bez_pliku
--   from public.reports;

-- 4c. Żadne zdjęcie ani podpis nie zgubiło się po drodze — liczby muszą się zgadzać
--     z tym, co było w starej tabeli:
--   select
--     (select count(*) from public.daily_reports d,
--        jsonb_array_elements(coalesce(d.photo_documentation,'[]'::jsonb))) as zdjecia_stare,
--     (select count(*) from public.reports r,
--        jsonb_array_elements(r.photos))                                    as zdjecia_nowe,
--     (select count(*) from public.daily_reports d,
--        jsonb_array_elements(coalesce(d.attendance_list,'[]'::jsonb)))     as podpisy_stare,
--     (select count(*) from public.reports r,
--        jsonb_array_elements(r.attendance))                                as podpisy_nowe;

-- 4d. Nic nie zostało bez odwołania do pliku (ani ścieżki, ani base64):
--   select r.id, e ->> 'id' as element
--   from public.reports r, jsonb_array_elements(r.photos) e
--   where e ->> 'path' is null and e ->> 'inline' is null
--   union all
--   select r.id, e ->> 'userName'
--   from public.reports r, jsonb_array_elements(r.attendance) e
--   where e ->> 'signaturePath' is null and e ->> 'signatureInline' is null;

-- ============================================================================
-- PO BACKFILLU I KILKU DNIACH SPOKOJU (uruchomić osobno, świadomie):
-- ============================================================================
--   alter table public.reports drop column legacy_pdf_base64;
--   drop table public.daily_reports;
