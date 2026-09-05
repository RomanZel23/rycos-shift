# Etap 0 — runbook wdrożenia

Kolejność ma znaczenie: najpierw sekrety, potem baza, potem deploy.
Między krokiem 2 a 4 aplikacja **nie będzie działać** (bucket prywatny, a stary
kod jeszcze o tym nie wie) — planuj to poza godzinami pracy brygad.

---

## 1. Rotacja sekretów (ręcznie, w panelach)

Zakładamy, że wszystko, co było dostępne przez otwarte API, wyciekło.

| Sekret | Gdzie | Uwagi |
|---|---|---|
| `RESEND_API_KEY` | resend.com → API Keys | Skasuj stary klucz, nie tylko dodaj nowy. Stary krążył w localStorage telefonów. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys | Rotacja unieważnia stary klucz wszędzie. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tamże | Po migracji SQL i tak nic nie daje, ale rotujemy dla porządku. |
| Hasła użytkowników | tabela `public.users` | Etap 1 wymieni je na Supabase Auth. Do tego czasu bramka `APP_ACCESS_CODE` jest jedyną realną ochroną. |

Wygeneruj też dwie nowe wartości:

```bash
openssl rand -hex 32   # GATE_SECRET
openssl rand -base64 9 # APP_ACCESS_CODE (albo własny, łatwy do podyktowania)
```

## 2. Przegląd logów pod kątem nadużyć

- **Resend → Logs**: czy z `raporty@shift.rycos.eu` poszło coś na adresy spoza listy odbiorców.
- **Supabase → Logs → API / Storage**: nietypowe wolumeny `GET /rest/v1/users`
  albo pobrania z `storage/v1/object/public/rycos-reports/`.

Jeśli coś wygląda podejrzanie: raporty zawierają dane osobowe i podpisy,
więc trzeba rozważyć zgłoszenie naruszenia (72 h od stwierdzenia).

## 3. Migracja SQL

Supabase → SQL Editor → wklej i uruchom:

```
supabase/migrations/0001_etap0_lockdown.sql
```

Następnie uruchom trzy zapytania weryfikacyjne z sekcji „WERYFIKACJA" na końcu pliku.
Oczekiwane wyniki: brak polityk `qual = true`, `public = false` na buckecie,
zero grantów dla roli `anon`.

## 4. Zmienne środowiskowe

### Vercel → Settings → Environment Variables

```
APP_ACCESS_CODE=<kod dla brygad>
GATE_SECRET=<openssl rand -hex 32>
SUPABASE_SERVICE_ROLE_KEY=<nowy>
NEXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<nowy>
RESEND_API_KEY=<nowy>
RESEND_FROM_EMAIL=raporty@shift.rycos.eu
```

### VPS przez Coolify — Build Pack: **Dockerfile** (aktualny sposób wdrożenia)

Zmienne ustawia się w **panelu Coolify → aplikacja → Environment Variables**,
a nie w pliku `.env` z repo — Coolify wstrzykuje własne. Plik `.env` na serwerze
przydaje się tylko przy ręcznym `docker compose up` z pominięciem Coolify.

Ponieważ build idzie z Dockerfile, **`docker-compose.yml` nie jest w ogóle
używany** — jego `build.args` i sekcja `environment` nie mają wpływu na produkcję.
Jedynym kanałem dla `ARG NEXT_PUBLIC_*` w Dockerfile są Build Variables z panelu.

| Zmienna | Build Variable? | Uwagi |
|---|---|---|
| `APP_ACCESS_CODE` | nie | Bez niej API zwraca 503. |
| `GATE_SECRET` | nie | `openssl rand -hex 32`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **nie** | Runtime only — jako build arg zostałby w warstwie obrazu. |
| `RESEND_API_KEY` | **nie** | j.w. |
| `RESEND_FROM_EMAIL` | nie | |
| `NEXT_PUBLIC_SUPABASE_URL` | **tak** | Inline'owana do bundla podczas `pnpm build`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **tak** | j.w. |

Pułapka numer jeden: **`NEXT_PUBLIC_*` bez zaznaczonego „Build Variable"**
przechodzą tylko jako runtime env. Next inline'uje je w czasie builda, więc
w przeglądarce wyjdą `undefined` i aplikacja zachowa się jak niepodłączona do
Supabase — pusta lista pracowników na ekranie logowania to pierwszy objaw.

Po ustawieniu zmiennych: **Redeploy**, nie restart. Restart nie przebuduje bundla,
więc zmiana `NEXT_PUBLIC_*` bez redeploya nic nie da.

**Healthcheck.** Obraz ma `HEALTHCHECK` bijący w `/api/health` — endpoint jest
poza bramką, więc odpowiada bez kodu dostępu i nie zdradza niczego poza tym,
czy `APP_ACCESS_CODE` i konfiguracja Supabase w ogóle istnieją:

```bash
curl -s https://<domena>/api/health
# {"status":"ok","config":{"gate":true,"supabase":true}}
```

`"gate": false` na produkcji = brak `APP_ACCESS_CODE`, całe API zwraca 503.
`"supabase": false` = brak URL-a albo `SUPABASE_SERVICE_ROLE_KEY`.

### VPS ręcznie (bez Coolify)

Uzupełnij `.env` obok `docker-compose.yml`, potem:

```bash
docker compose up -d --build
```

`docker-compose.yml` ma teraz twarde wymagania — brak `APP_ACCESS_CODE`
lub `SUPABASE_SERVICE_ROLE_KEY` zatrzyma start z czytelnym komunikatem
zamiast wystawiać otwarte API.

## 5. Deploy i test dymny

1. Otwórz aplikację w trybie prywatnym → powinien pojawić się ekran **„Autoryzacja urządzenia"**.
2. Wpisz `APP_ACCESS_CODE` → przechodzisz do logowania.
3. Zaloguj się, wejdź w **Archiwum** → miniatury zdjęć i podpisy z historycznych
   raportów muszą się załadować (idą teraz przez `/api/files`).
4. Pobierz PDF z archiwum → plik ma się wygenerować bez pustych ramek na podpisy.
5. Z innej przeglądarki, bez kodu:
   ```bash
   curl -i https://<domena>/api/db/sync
   ```
   Oczekiwane: `401` i `"code":"GATE_LOCKED"`.
6. Sprawdź, że publiczny URL Storage już nie działa:
   ```bash
   curl -i https://<projekt>.supabase.co/storage/v1/object/public/rycos-reports/pdf/<dowolny>.pdf
   ```
   Oczekiwane: `400`/`404`, nie `200`.

## 6. Dystrybucja kodu do zespołu

Kod podaje się raz na telefon, ciasteczko żyje 30 dni. Przy zgubionym urządzeniu:
zmień `APP_ACCESS_CODE` **i** `GATE_SECRET` → wszystkie urządzenia proszą o kod ponownie.

---

## Czego Etap 0 NIE naprawia

Świadomie, żeby diff dało się przejrzeć:

- Logowanie pracownika nadal jest weryfikowane po stronie klienta i wciąż działają
  hasła `admin` / `1234` / `password123`. **Bramka chroni przed internetem, nie przed
  kimś, kto zna kod dostępu.** To Etap 1.
- `/api/send-report` nadal przyjmuje `recipients` i `apiKey` z body — ale jest już
  za bramką, więc nie jest otwartym relayem dla całego świata. To Etap 2.
- Raporty wciąż jeżdżą jako base64 i wciąż mówią „wysłano" przy błędzie wysyłki. Etap 2.
- Hasła w tabeli `users` nadal plaintext. Etap 1.
