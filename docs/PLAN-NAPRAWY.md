# RYCOS Shift — audyt i plan naprawy

Data przeglądu: 2026-09-05 · wersja w repo: 1.3.0 · Next 16.3.3 / React 19 / Supabase

Przegląd statyczny całego `src/`, `supabase/schema.sql`, `prisma/`, Dockerfile i compose.
Buildu nie udało się uruchomić (lokalne środowisko wykonawcze niedostępne w tej sesji), więc
nie ma tu wyników `tsc`/`eslint` — wszystkie punkty wynikają z czytania kodu.

---

## Podsumowanie w trzech zdaniach

Aplikacja od strony produktowej jest kompletna i przemyślana — formularze, podpisy, PWA, PDF, archiwum, panel admina.
Natomiast **warstwa bezpieczeństwa praktycznie nie istnieje**: logowanie jest fikcją po stronie klienta, API jest w pełni
otwarte, baza ma RLS `USING (true)`, a bucket z podpisami i danymi osobowymi jest publiczny.
Drugi blok problemów to pipeline raportu: base64 wszędzie (rozbija Vercela i localStorage), „wysłano!" nawet gdy mail nie poszedł,
i brak paginacji raportu porannego.

---

## P0 — Krytyczne (blokujące produkcję)

### 1. Zero autoryzacji po stronie serwera
Nie ma `middleware.ts`, nie ma sesji, nie ma cookie.

- `GET /api/db/sync` — publicznie oddaje **wszystkich użytkowników, ustawienia tenanta i wszystkie raporty**
  (nazwiska, role, GPS, podpisy, zdjęcia z budowy).
- `POST /api/db/sync` — anonim może wysłać `{"action":"SYNC_USERS","users":[]}` i **skasować wszystkich użytkowników**.
  To samo dla placów, tematów i ustawień (łącznie z listą mailingową i adresem nadawcy).

### 2. Logowanie jest atrapą
`src/components/LoginForm.tsx:44-95`

- Weryfikacja hasła dzieje się w przeglądarce, na liście userów pobranej publicznym GET-em.
- `GET /api/db/sync` **nie mapuje pola `password`** (`route.ts:32-41`), więc `foundUser.password` jest zawsze `undefined`
  → `validPassword` degraduje się do stałej `"password123"`.
- Dodatkowo zahardkodowane uniwersalne hasła: `"admin"`, `"1234"`, `"password123"` (linie 59 i 81-86).
- **Efekt: kto zna URL, loguje się jako `Marcin Bajda` z `is_admin = true`.**
- `SYNC_USERS` nie wysyła `password` do bazy (`api/db/sync/route.ts:194-202`) → pole „hasło" w panelu admina
  nie zapisuje niczego trwałego. W bazie hasła i tak leżą plaintextem (`supabase/schema.sql:15, 113-120`).

### 3. `/api/send-report` to otwarty relay pocztowy
`src/app/api/send-report/route.ts`

- Brak auth, a `recipients` przychodzą z body → **każdy może wysłać dowolny PDF na dowolny adres**
  z Twojej zweryfikowanej domeny `shift.rycos.eu`. Ryzyko: phishing pod Twoją marką + spalenie reputacji domeny i konta Resend.
- `apiKey` też przychodzi z body (linia 52) — klient podstawia własny albo używa Twojego.
- Linia 112: `fetch(pdfBase64)` gdy wartość zaczyna się od `http` → **SSRF**, serwer pobierze dowolny URL.
- Linie 194 / 202 / 210 / 222: `siteName`, `foremanName`, `date`, `fileName` wstrzykiwane do HTML maila **bez escapowania**.

### 4. RLS w Supabase to atrapa
`supabase/schema.sql:169-174` — `FOR ALL USING (true) WITH CHECK (true)` na sześciu tabelach.
W połączeniu z `NEXT_PUBLIC_SUPABASE_ANON_KEY` w bundlu przeglądarki oznacza to, że **każdy może czytać i pisać
tabelę `users` (z hasłami) bezpośrednio z Supabase**, całkowicie omijając Twoje API.

### 5. Publiczny bucket z danymi osobowymi
`supabase/schema.sql:89-104` — bucket `rycos-reports` ustawiony `public = true`, polityki SELECT/INSERT/UPDATE bez żadnego warunku.
Leżą tam PDF-y z listami obecności, **odręcznymi podpisami**, imionami, nazwiskami i współrzędnymi GPS pracowników,
dostępne pod zgadywalnym URL-em CDN. Dowolny anonim może też tam wgrywać i nadpisywać pliki.

**To jest incydent RODO gotowy do zgłoszenia**, nie tylko dług techniczny.

### 6. Klucz Resend w localStorage
`AdminSettings.tsx:84, 235` → `storage.ts` → formularze wysyłają go w body (`StartShiftForm.tsx:201`).
Sekret produkcyjny leży w przeglądarce każdego brygadzisty.

### 7. `src/lib/supabase.ts` miesza klienta z serwerem
Jeden moduł dla obu stron, z preferencją dla `SUPABASE_SERVICE_ROLE_KEY` (linia 9).
Dziś ratuje Cię tylko to, że Next nie inline'uje zmiennych bez `NEXT_PUBLIC_`. Jeden import w komponencie klienckim
albo jeden refaktor i **service_role ląduje w bundlu**.

### 8. `.dockerignore` przepuszcza sekrety
Brakuje `.env*` i `.pnpm-store` → `COPY . .` w Dockerfile wnosi pliki `.env` do warstwy obrazu
i pompuje kontekst builda o setki megabajtów store'u pnpm leżącego w katalogu projektu.

---

## P1 — Błędy funkcjonalne

### 9. „Raport wysłany!" nawet gdy mail nie poszedł
`StartShiftForm.tsx:205-210`, `EndShiftForm.tsx:216-221` — błąd wysyłki kończy się na `console.warn`,
a ekran sukcesu pokazuje się zawsze. `status` jest zapisywany na sztywno jako `"SENT"`, mimo że typ przewiduje
`FAILED` i `SAVED_LOCAL`. Dodatkowo brak klucza Resend daje `success: true, simulated: true`
(`send-report/route.ts:99-105`), więc UI też melduje wysyłkę.

W systemie dokumentującym odprawy BHP to najgorszy możliwy rodzaj błędu: brygadzista jest przekonany, że raport poszedł.

### 10. Base64 wszędzie — rozbija produkcję
PDF trafia jako `data:` URL (`pdf.output("datauristring")`) w trzy miejsca naraz: do `/api/send-report`,
do localStorage i do `/api/db/sync`. Przy sześciu zdjęciach i `scale: 2` to spokojnie 10-30 MB.

- **Vercel**: limit ciała requestu ~4.5 MB → wysyłka pada na produkcji.
- **localStorage**: limit ~5 MB → `saveStoredReport` łapie wyjątek i robi `console.warn` (`storage.ts:156`)
  → **raport cicho znika**.
- `optimizedReport` z lekkimi URL-ami CDN jest zwracany przez API, ale `page.tsx:245-261` go ignoruje,
  więc lokalna kopia zostaje z base64 na zawsze.

### 11. Raport porannny nie ma paginacji
`pdf-html-templates.ts:159` — jedna sztywna strona `height: 1123px; overflow: hidden`.
Dłuższa lista obecności albo więcej tematów BHP = **treść po cichu ucięta**.
END_SHIFT ma podział (4 zdjęcia na pierwszej, po 6 na kolejnych), START_SHIFT nie ma nic.

### 12. Archiwum regeneruje PDF zamiast pobierać zarchiwizowany
`ReportArchive.tsx:110-123` — `generateReportPDFAsync(report)` przy każdym pobraniu.
Dla dokumentu z podpisami to problem prawny: **plik pobrany dziś może różnić się od tego, który poszedł mailem**
(inna wersja szablonu, inne dane). `pdfDataUrl` z bucketa jest używany tylko w bloku `catch`.

### 13. Edytor szablonów PDF jest martwy
`pdf_templates.html_content` zapisuje się do bazy i wraca do UI, ale generator zawsze używa zahardkodowanych
`generateStartShiftHtml` / `generateEndShiftHtml` (`pdf-generator.ts:68-71`).
Admin edytuje i „zapisuje" szablon, który nigdy nie zostanie użyty.

### 14. Pobieranie PDF w StartShiftForm
`StartShiftForm.tsx:236-242` — brak `link.download` (EndShiftForm go ma).
Na iOS/Safari plik się nie pobierze poprawnie. Nigdzie nie ma `URL.revokeObjectURL()`.

### 15. Kolizyjne ID raportów
`"rep-start-" + Date.now()` — dwa telefony w tej samej milisekundzie nadpiszą sobie raport (upsert po `id`).
Do zamiany na `crypto.randomUUID()`.

### 16. „Delete all not in list" zamiast CRUD
`api/db/sync/route.ts:189-192, 219-222, 246-249` — każdy `SYNC_*` kasuje z bazy wszystko, czego nie ma
w liście przysłanej przez klienta. Dwa urządzenia z rozjechanym cache = jedno kasuje zmiany drugiego.

### 17. Kolejka „brakujących" raportów rośnie bez końca
`page.tsx:99-122` — przy każdym syncu lokalne raporty nieobecne w chmurze są ponownie wysyłane,
bez oznaczania że już poszły i bez limitu prób.

### 18. Twarde adresy e-mail pracowników w kodzie
`storage.ts:15-28` — pięć służbowych adresów zaszytych w repozytorium, rozjeżdżających się z bazą.

### 19. Warstwa łatek na starą domenę
`storage.ts:101-118`, `send-report/route.ts:61-79`, `ReportArchive.tsx:141-149` — trzy niezależne miejsca
poprawiające `solutionsbay.pl` → `shift.rycos.eu` w locie. Do zastąpienia jedną migracją danych.

---

## P2 — Infrastruktura i jakość

### 20. `docker-compose.yml` nie przekazuje zmiennych Supabase
Ani jako `build.args`, ani jako `environment`. Dockerfile deklaruje `ARG NEXT_PUBLIC_SUPABASE_URL` itd., ale nikt ich nie podaje.
**Wdrożenie na VPS startuje bez bazy** — pusta lista użytkowników, brak możliwości logowania.

### 21. Dockerfile
- Nie kopiuje `pnpm-workspace.yaml` (`ignoredBuiltDependencies: sharp, unrs-resolver`) → install w obrazie może próbować budować `sharp`.
- `node:20-alpine` → warto podnieść do 22.
- Brak `HEALTHCHECK`.

### 22. Martwe zależności
`clsx`, `tailwind-merge`, `react-signature-canvas`, `@prisma/client` — **żadna nie jest importowana w `src/`**.
`prisma/schema.prisma` to nieużywany duplikat `supabase/schema.sql` (dwa źródła prawdy dla tego samego schematu).
`babel-plugin-react-compiler` bez włączonego `reactCompiler` w `next.config.ts`.

### 23. `--webpack` w `dev` i `build`
Wyjście z domyślnego Turbopacka w Next 16 — warto sprawdzić, czy obejście jest jeszcze potrzebne.

### 24. Brak nagłówków bezpieczeństwa
`next.config.ts` ma tylko `output: "standalone"`. Brakuje CSP, HSTS, `X-Frame-Options`,
`Permissions-Policy` (geolokalizacja, mikrofon — a aplikacja używa obu).

### 25. Higiena repo
- `.pnpm-store/` (setki katalogów) leży w katalogu projektu.
- Zero testów, brak CI.
- `.env.example` niespójny z tym, czego faktycznie wymaga compose.

### 26. Offline
Service worker jest network-first bez precache'u i bez kolejki zapisu.
Aplikacja terenowa na LTE, w której odprawa złożona poza zasięgiem po prostu przepada.

---

## Plan naprawy

### Etap 0 — zatrzymać krwawienie (dziś, ~1 dzień)

1. Zrotować **wszystkie** sekrety: Resend API key, Supabase `service_role` i `anon`, hasła użytkowników.
2. Bucket `rycos-reports` → `public = false`; usunąć polityki `USING (true)`; dostęp wyłącznie przez signed URL z serwera.
3. Zamknąć RLS: odebrać roli `anon` dostęp do wszystkich tabel; ruch tylko przez serwer na `service_role`.
4. Tymczasowa bramka na `/api/*` (choćby wspólny sekret w cookie `httpOnly`), zanim wejdzie prawdziwa autoryzacja.
5. `.dockerignore`: dopisać `.env*`, `.pnpm-store`, `docs`.
6. Sprawdzić w logach Resend i Supabase, czy ktoś już z tego nie skorzystał.

### Etap 1 — prawdziwa autentykacja (3-5 dni)

- **Rekomendacja: Supabase Auth** + tabela `profiles` (`is_admin`, `is_foreman`, `role`) i polityki RLS po `auth.uid()`.
  Najmniej kodu i RLS zaczyna faktycznie działać. Alternatywa: własne sesje (argon2 + cookie `httpOnly` + `middleware.ts`).
- Usunąć weryfikację hasła z klienta i wszystkie trzy backdoory.
- Tryb „Wybór Pracownika" zostawić jako wygodę w terenie, ale z realnym PIN-em weryfikowanym serwerowo i rate limitingiem.
- Każdy route sprawdza sesję; akcje `SYNC_*` i `DELETE_*` tylko dla `is_admin`.
- Hasła: argon2id, nigdy nie wracają w żadnym GET.

### Etap 2 — pipeline raportu (2-3 dni)

- `recipients`, `fromEmail`, `apiKey` **wyłącznie po stronie serwera** (z bazy / ENV) — usunąć z body requestu.
- Escapowanie HTML w mailu; usunąć `fetch()` po URL z body (albo whitelist wyłącznie własnego bucketa).
- Nowy przepływ: klient generuje PDF → wysyła **blob** przez `multipart/form-data` do `/api/reports`
  → serwer wrzuca do prywatnego bucketa → wysyła mail z załącznikiem → zapisuje wiersz z URL-em.
  Klient nigdy nie trzyma base64. Rozwiązuje jednocześnie limit Vercela i limit localStorage.
- Realny status: `SENT` / `FAILED` / `QUEUED`; UI pokazuje błąd zamiast zielonego ptaszka; ponowienie z archiwum.
- localStorage tylko na metadane; kolejka offline w IndexedDB (blobów).

### Etap 3 — sam dokument (2-3 dni)

- Paginacja START_SHIFT: nagłówek + N wierszy na stronę + stopka „strona X z Y".
- Archiwum pobiera zarchiwizowany plik (signed URL); regeneracja tylko jako fallback i wyraźnie oznaczona w UI.
- Decyzja o edytorze szablonów: albo podpiąć `html_content` do generatora, albo usunąć zakładkę z panelu.
- **Rozważyć generowanie PDF na serwerze** (Playwright/Chromium) zamiast html2canvas.
  Zysk: tekst przeszukiwalny zamiast rastra, wektorowe podpisy, plik kilkanaście razy mniejszy,
  telefon nie renderuje 30 MB obrazów. To największy pojedynczy skok jakości w całym projekcie.

### Etap 4 — porządki (1-2 dni)

- Rozdzielić `supabase-server.ts` / `supabase-browser.ts`.
- Usunąć martwe zależności; zdecydować o Prismie (usunąć albo uczynić jedynym źródłem migracji).
- `docker-compose`: przekazać zmienne jako `args` + `environment`; Dockerfile: `pnpm-workspace.yaml`, node:22, healthcheck.
- Nagłówki bezpieczeństwa w `next.config.ts`.
- `crypto.randomUUID()`, usunięcie twardych adresów e-mail, jednorazowa migracja `solutionsbay.pl` → `shift.rycos.eu`
  i skasowanie trzech warstw łatek.
- `.pnpm-store` poza repo.
- Minimalny zestaw testów: generator PDF (liczba stron dla 5 / 15 / 40 pracowników), mapowanie DB ↔ typy,
  kontrola dostępu do każdego route'u.

---

## Nota RODO

Raporty zawierają imię, nazwisko, funkcję, **podpis odręczny** i współrzędne GPS pracownika.
Publiczny bucket plus w pełni otwarte API to naruszenie, które w obecnym stanie kwalifikuje się do zgłoszenia.
Poza naprawą techniczną warto dopisać: politykę retencji (np. 3 lata zgodnie z okresem przechowywania
dokumentacji BHP), procedurę usuwania danych pracownika i rejestr czynności przetwarzania.

---

## Sugerowana kolejność w praktyce

Etapy 0 i 1 są nierozłączne — dopóki nie ma autentykacji, reszta poprawek niczego nie chroni.
Etap 2 jest wart zrobienia zaraz po nich, bo dziś aplikacja **cicho gubi raporty** i kłamie o wysyłce,
a to podważa sens całego systemu. Etapy 3 i 4 można rozłożyć w czasie.

Łącznie: około 9-14 dni roboczych do stanu, w którym system nadaje się na produkcję z prawdziwymi danymi osobowymi.
