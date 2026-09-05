# Etap 2 — runbook wdrożenia (pipeline raportu)

Zakłada wdrożone Etapy 0 i 1. Kolejność: migracja SQL → redeploy → test dymny.

---

## Co się zmienia

Trzy rzeczy, które do tej pory nie działały uczciwie:

1. **Ekran sukcesu kłamał.** Błąd wysyłki lądował w `console.warn`, a status
   zapisywał się na sztywno jako `SENT`. Brygadzista widział zielony ptaszek
   niezależnie od tego, czy mail wyszedł. Teraz nieudana wysyłka daje status
   `EMAIL_FAILED`, bursztynowy ekran i konkretny powód.
2. **PDF jechał trzy razy jako base64** — mailem, do localStorage i do bazy.
   Rozbijało to limit ciała żądania i limit localStorage (raport cicho znikał).
   Teraz PDF idzie raz, jako binarny part `multipart/form-data`.
3. **Odbiorcy i klucz Resend pochodziły z przeglądarki.** Endpoint przyjmował
   dowolne `recipients` i dowolny `apiKey`. Teraz jedno i drugie bierze się
   wyłącznie z serwera.

## 1. Migracja SQL

Supabase → SQL Editor → `supabase/migrations/0003_etap2_reports.sql`.

Dodaje `error_message`, `created_by`, `created_by_name` oraz indeksy na
`status` i `date`. Na końcu pliku dwa zapytania weryfikacyjne.

## 2. Zmienna środowiskowa

`RESEND_API_KEY` musi być ustawiony w Coolify (runtime, **bez** „Build Variable").
Już go masz — ale od teraz jest jedynym miejscem, gdzie ten klucz istnieje.
Pole „Klucz API Resend" zniknęło z panelu Ustawień; w jego miejscu jest notka
wyjaśniająca, gdzie klucz żyje.

Jeśli klucza zabraknie, raporty nadal się zapiszą, ale ze statusem `EMAIL_FAILED`
i komunikatem wprost mówiącym, czego brakuje — zamiast dawnej „symulowanej wysyłki",
która raportowała sukces.

## 3. Redeploy i test dymny

1. Złóż raport rozpoczęcia prac → ekran zielony, lista odbiorców widoczna, mail dochodzi.
2. W Coolify tymczasowo usuń `RESEND_API_KEY` → redeploy → złóż raport.
   Oczekiwane: ekran **bursztynowy**, „zapisany, ale nie wysłany", raport widoczny
   w archiwum. Przywróć klucz.
3. Archiwum → „Wyślij ponownie" na tym raporcie → mail dochodzi, status wraca na `SENT`.
4. Sprawdź, że stary endpoint jest wycofany:
   ```bash
   curl -i -X POST https://shift.rycos.eu/api/send-report   # 410 ENDPOINT_REMOVED (po zalogowaniu)
   ```

> **Uwaga o PWA.** Urządzenia z zbuforowaną starą wersją aplikacji będą jeszcze
> przez chwilę uderzać w `/api/send-report`. Dlatego endpoint nie został skasowany,
> tylko zwraca 410 z czytelnym komunikatem „odśwież aplikację". Katalog
> `src/app/api/send-report/` można usunąć, gdy wszystkie telefony się odświeżą.

## 4. Nowe endpointy

| Endpoint | Kto | Co robi |
|---|---|---|
| `POST /api/reports` | zalogowany | multipart: `payload` (JSON) + `pdf` (blob). Wrzuca PDF do prywatnego bucketu, wysyła mail z konfiguracji serwera, zapisuje wiersz z prawdziwym statusem. |
| `POST /api/reports/resend` | zalogowany | `{ reportId }`. Bierze **zarchiwizowany** plik PDF z bucketu i aktualnych odbiorców z bazy. Klient nie ma wpływu ani na załącznik, ani na adresatów. |
| `POST /api/send-report` | — | wycofany, 410. |

Autor raportu (`created_by`) bierze się z sesji, nie z ciała żądania.

---

## Czego Etap 2 NIE naprawia

- **Zdjęcia i podpisy nadal jadą jako base64** wewnątrz pola `payload`. Są już
  kompresowane po stronie klienta (JPEG 0.70) i lądują w buckecie, ale przy
  kilkunastu zdjęciach payload wciąż jest spory. Przeniesienie ich na osobne
  party multipart to naturalny kolejny krok, jeśli zobaczysz odrzucenia na dużych
  fotorelacjach.
- **Kolejka offline nadal siedzi w localStorage.** Raport złożony bez zasięgu
  zapisuje się lokalnie i dosyła przy następnej synchronizacji — ale przez stary
  `/api/db/sync`, więc bez maila (trzeba go potem wysłać z Archiwum). Docelowo
  bloby PDF powinny trafić do IndexedDB, a kolejka wysyłać przez `/api/reports`.
  To osobny kawałek pracy — nazwijmy go Etap 2b.
- **Raport porannny nadal nie ma paginacji** i ucina długie listy obecności
  (`overflow: hidden` na sztywnej stronie 1123 px). **Etap 3.**
- **Archiwum nadal regeneruje PDF** przy pobieraniu, zamiast oddać zarchiwizowany
  plik. Ponowna wysyłka już używa oryginału, ale przycisk „Pobierz" jeszcze nie.
  **Etap 3.**
