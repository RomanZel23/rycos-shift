-- ==============================================================================
-- RYCOS Shift Database Schema for Supabase (PostgreSQL)
-- Project: https://nippewqmdgcjdeftvmdz.supabase.co
-- ==============================================================================

-- 1. Tabela Użytkowników i Pracowników
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Pracownik',
    is_foreman BOOLEAN NOT NULL DEFAULT false,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    login TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela Placów Budów
CREATE TABLE IF NOT EXISTS public.construction_sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela Szablonów Tematów Odpraw / BHP
CREATE TABLE IF NOT EXISTS public.topic_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'BHP',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela Raportów Dziennych (Rozpoczęcie i Zakończenie prac)
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'tenant-sb-tech-poznan',
    report_type TEXT NOT NULL, -- 'START_SHIFT' lub 'END_SHIFT'
    date TEXT NOT NULL, -- YYYY-MM-DD
    time TEXT NOT NULL, -- HH:mm
    site_id TEXT,
    site_name TEXT NOT NULL,
    foreman_id TEXT,
    foreman_name TEXT NOT NULL,
    location JSONB DEFAULT '{}'::jsonb, -- { latitude, longitude, accuracy }
    discussed_topics JSONB DEFAULT '[]'::jsonb,
    attendance_list JSONB DEFAULT '[]'::jsonb, -- pracownicy i podpisy odręczne
    photo_documentation JSONB DEFAULT '[]'::jsonb, -- zdjęcia i opisy
    pdf_file_name TEXT NOT NULL,
    pdf_data_url TEXT,
    sent_to_emails JSONB DEFAULT '[]'::jsonb,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'SENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela Ustawień Instancji (Tenant / Multi-Tenancy)
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    tenant_id TEXT PRIMARY KEY,
    organization_name TEXT NOT NULL DEFAULT 'SolutionsBay / SB Technology',
    logo_text TEXT NOT NULL DEFAULT 'SB Technology',
    logo_subtitle TEXT NOT NULL DEFAULT 'RYCOS Shift workflow',
    start_shift_email_recipients JSONB DEFAULT '["raporty-start@solutionsbay.pl"]'::jsonb,
    end_shift_email_recipients JSONB DEFAULT '["raporty-koniec@solutionsbay.pl"]'::jsonb,
    resend_from_email TEXT DEFAULT 'raporty@shift.rycos.eu',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INICJALNE DANE STARTOWE (SEED DATA)
-- ==============================================================================

-- Inicjalny Kierownik i Brygadziści
INSERT INTO public.users (id, first_name, last_name, role, is_foreman, is_admin, login, password)
VALUES 
  ('usr-admin-1', 'Marcin', 'Bajda', 'Kierownik Operacyjny / Admin', true, true, 'm.bajda', 'password123'),
  ('usr-foreman-1', 'Jan', 'Kowalski', 'Brygadzista Główny', true, false, 'j.kowalski', 'password123'),
  ('usr-foreman-2', 'Marek', 'Wiśniewski', 'Brygadzista Montażu', true, false, 'm.wisniewski', 'password123'),
  ('usr-worker-1', 'Piotr', 'Nowak', 'Montażysta konstrukcji', false, false, 'p.nowak', 'password123'),
  ('usr-worker-2', 'Tomasz', 'Zieliński', 'Cieśla szalunkowy', false, false, 't.zielinski', 'password123'),
  ('usr-worker-3', 'Andrzej', 'Wójcik', 'Zbrojarz', false, false, 'a.wojcik', 'password123'),
  ('usr-worker-4', 'Krzysztof', 'Kozłowski', 'Operator sprzętu', false, false, 'k.kozlowski', 'password123'),
  ('usr-worker-5', 'Michał', 'Lewandowski', 'Pomocnik budowlany', false, false, 'm.lewandowski', 'password123')
ON CONFLICT (id) DO UPDATE SET 
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  is_foreman = EXCLUDED.is_foreman,
  is_admin = EXCLUDED.is_admin;

-- Inicjalne Place Budowy Poznań
INSERT INTO public.construction_sites (id, name, address, active)
VALUES
  ('site-1', 'Poznań - Piątkowo', 'ul. Wojciechowskiego, Poznań', true),
  ('site-2', 'Poznań - Franowo', 'ul. Szwedzka, Poznań', true),
  ('site-3', 'Poznań - Grunwald', 'ul. Marcelińska, Poznań', true)
ON CONFLICT (id) DO NOTHING;

-- Inicjalne Szablony Tematów BHP
INSERT INTO public.topic_templates (id, title, category)
VALUES
  ('top-1', 'Szkolenie BHP i instruktaż stanowiskowy przed rozpoczęciem prac', 'BHP'),
  ('top-2', 'Weryfikacja środków ochrony indywidualnej (szelki, kaski, okulary, rękawice)', 'BHP'),
  ('top-3', 'Rozdysponowanie zadań montażowych na dzień bieżący', 'Organizacja'),
  ('top-4', 'Procedury bezpieczeństwa przy pracach na wysokości i rusztowaniach', 'BHP'),
  ('top-5', 'Sprawdzenie stanu technicznego elektronarzędzi i maszyn', 'Sprzęt'),
  ('top-6', 'Koordynacja transportu materiałów i strefy rozładunku', 'Logistyka'),
  ('top-7', 'Zasady komunikacji radiowej i sygnalizacji z operatorem żurawia', 'Organizacja')
ON CONFLICT (id) DO NOTHING;

-- Inicjalne Ustawienia Instancji
INSERT INTO public.tenant_settings (tenant_id, organization_name, logo_text, logo_subtitle, start_shift_email_recipients, end_shift_email_recipients, resend_from_email)
VALUES
  ('tenant-sb-tech-poznan', 'SolutionsBay / SB Technology', 'SB Technology', 'RYCOS Shift workflow', '["raporty-start@solutionsbay.pl", "kierownik.budowy@solutionsbay.pl"]'::jsonb, '["raporty-koniec@solutionsbay.pl", "kierownik.budowy@solutionsbay.pl", "zarzad@solutionsbay.pl"]'::jsonb, 'raporty@shift.rycos.eu')
ON CONFLICT (tenant_id) DO NOTHING;

-- Uprawnienia do odczytu/zapisu (Row Level Security - domyślnie otwarte dla aplikacji z kluczem anon/service)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read/write users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write sites" ON public.construction_sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write topics" ON public.topic_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write reports" ON public.daily_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write settings" ON public.tenant_settings FOR ALL USING (true) WITH CHECK (true);
