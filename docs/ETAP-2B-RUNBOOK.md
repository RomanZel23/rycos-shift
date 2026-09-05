# Etap 2b — nowa tabela `public.reports`

Wdrażane **razem z Etapem 2**, jednym deployem. Kolejność w Supabase: `0003`, potem `0004`.

---

## Dlaczego nowa tabela, a nie kosmetyka

`daily_reports` pozwalała trzymać w `pdf_data_url` trzy różne rzeczy: base64,
publiczny URL CDN i ścieżkę aplikacji. Stąd wziął się błąd, przez który
ponowna wysyłka nie widziała żadnego z ośmiu istniejących raportów — kod
rozumiał jeden format, w bazie były trzy.

W `public.reports` jest jedna dozwolona forma odwołania do pliku: **ścieżka
w buckecie**, pilnowana przez `CHECK`. Baza fizycznie nie przyjmie URL-a ani
base64. Adresy `/api/files?path=…` powstają dopiero przy odczycie, w jednym
miejscu (`src/lib/report-mapper.ts`).

Przy okazji: `date TEXT` → `date`, `time TEXT` → `time`, `status` z `CHECK`
na dozwolone wartości, `report_type` też.

## Co jest wykonane i sprawdzone

Migrację uruchomiłem na lokalnym PostgreSQL 16 z **prawdziwym zrzutem Twojej
tabeli** (8 wierszy, 2953 kB). Wyniki:

| Sprawdzenie | Wynik |
|---|---|
| Liczba wierszy | 8 → 8 |
| PDF-y | 6 ze ścieżką w buckecie, 2 z base64 do przeniesienia, **0 bez pliku** |
| Zdjęcia | 17 → 17 |
| Podpisy | 12 → 12 |
| Elementy bez odwołania do pliku | 0 |
| `CHECK` odrzuca URL / base64 / zły status / zły typ | tak, wszystkie cztery |
| Round-trip przez mapper i z powrotem do bazy | 8/8 zgodnych (daty, PDF, liczby podpisów i zdjęć) |

## 1. Migracje

```
supabase/migrations/0003_etap2_reports.sql   (kolumny statusu i autorstwa)
supabase/migrations/0004_reports_table.sql   (nowa tabela + przeniesienie)
```

`0004` **nie kasuje** `daily_reports`. Stara tabela zostaje jako kopia.
Zapytania weryfikacyjne są zakomentowane na końcu pliku — uruchom je po migracji,
zwłaszcza 4b (kolumna `bez_pliku` musi być zerowa) i 4c (liczby zdjęć i podpisów).

## 2. Deploy

Coolify → Redeploy. Zmiennych środowiskowych nie ruszasz.

## 3. Backfill mediów — jednorazowo, po deployu

Dwóch najstarszych raportów (2026-09-01) nie da się dokończyć SQL-em: ich PDF-y,
podpisy i zdjęcia siedzą jako base64 w kolumnie, a z SQL-a nie ma jak wgrać pliku
do Storage. Domyka to endpoint dostępny **tylko dla administratora**:

```bash
# najpierw podejrzyj, co jest do zrobienia — nic nie zmienia
curl -s https://shift.rycos.eu/api/admin/backfill-media \
     -H "Cookie: <ciasteczka z zalogowanej sesji admina>"

# wykonanie
curl -s -X POST https://shift.rycos.eu/api/admin/backfill-media \
     -H "Cookie: <j.w.>"
```

Najprościej: zaloguj się jako admin w przeglądarce i wejdź na
`/api/admin/backfill-media` (GET pokaże podsumowanie). POST wykonaj z konsoli
przeglądarki: `fetch("/api/admin/backfill-media",{method:"POST"}).then(r=>r.json()).then(console.log)`.

Endpoint kasuje base64 z wiersza **dopiero** po wgraniu pliku do bucketu
i odczytaniu go z powrotem z porównaniem długości. Cokolwiek się nie zgadza —
wiersz zostaje nietknięty, a raport dalej działa na base64.

Po backfillu ponów zapytanie GET: powinno zwrócić „nie ma nic do przeniesienia".

## 4. Sprzątanie — dopiero po kilku dniach spokojnej pracy

Na końcu `0004` czekają dwie zakomentowane komendy. Uruchom je świadomie, osobno:

```sql
alter table public.reports drop column legacy_pdf_base64;
drop table public.daily_reports;
```

Do tego czasu masz pełną kopię danych sprzed migracji.

---

## Co się zmieniło w kodzie

| Plik | Rola |
|---|---|
| `src/lib/report-mapper.ts` | **jedyne** miejsce tłumaczenia wiersz ↔ `DailyReport`. Ścieżka → `/api/files` przy odczycie, `/api/files` → ścieżka przy zapisie. |
| `src/app/api/reports/route.ts` | zapis nowego raportu do `reports` |
| `src/app/api/reports/resend/route.ts` | czyta `pdf_path` / `legacy_pdf_base64` |
| `src/app/api/db/sync/route.ts` | odczyt archiwum z `reports`; `SAVE_REPORT` obsługuje już tylko kolejkę offline |
| `src/app/api/admin/backfill-media/route.ts` | jednorazowe przeniesienie base64 → bucket |

Jedna zmiana w zachowaniu, o której warto wiedzieć: raport dosłany z kolejki
offline (przez `SAVE_REPORT`) dostaje status **`FAILED`** z komunikatem, że mail
nie poszedł — bo faktycznie nie poszedł. Trzeba go wysłać ręcznie z Archiwum.
Wcześniej taki raport lądował jako `SENT` i nikt się nie orientował.
