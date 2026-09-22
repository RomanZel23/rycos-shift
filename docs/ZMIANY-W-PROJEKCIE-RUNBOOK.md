# Rejestr zmian w projekcie — wdrożenie

Trzeci workflow: karta zmiany („Jest” / „Powinno być”, KNA) wysyłana do
akceptujących, decyzja Akceptuję / Odrzucam z podpisem, blokada treści po
pierwszej akceptacji, archiwum kart.

## 1. Migracje (Supabase SQL Editor, w tej kolejności)

```
supabase/migrations/0006_akceptacja_zmian_uzytkownicy.sql
supabase/migrations/0007_rejestr_zmian.sql
```

Obie są addytywne — nie zmieniają istniejących danych i obecna wersja
aplikacji działa z nimi bez zmian. **Uruchom je przed wypchnięciem kodu**
(Coolify buduje z GitHuba po pushu).

Sprawdzone na lokalnym PostgreSQL 16 (schema.sql + 0001–0007):

| Sprawdzenie | Wynik |
|---|---|
| Akceptujący bez adresu e-mail | odrzucony (`users_acceptor_has_email`) |
| Adres w złym formacie | odrzucony (`users_email_format`) |
| Numeracja | 2026 → 1, 2; 2027 → 1 (licznik per rok) |
| Karta z pustą nazwą | odrzucona |
| Odrzucenie bez komentarza | odrzucone |
| Decyzja bez podpisu i czasu | odrzucona |
| Podpis spoza bucketu (URL) | odrzucony |
| Usunięcie karty | decyzje usunięte kaskadowo |
| Dostęp roli `anon` | `permission denied` |

## 2. Zmienne środowiskowe (Coolify)

| Zmienna | Wartość |
|---|---|
| `APP_BASE_URL` | `https://shift.rycos.eu` (opcjonalna — to wartość domyślna) |

Reszta bez zmian (Resend, Supabase, sekrety).

## 3. Konfiguracja w aplikacji (administrator)

1. **Ustawienia → Użytkownicy → Kompetencje** przy każdym akceptującym:
   zaznacz „Akceptacja zmian w projekcie” i wpisz adres e-mail.
2. **Poświadczenia** → nadaj akceptującemu **PIN** (bez PIN-u link z maila nie wpuści).
3. Opcjonalnie wpisz adres e-mail autorom kart (brygadzistom) — dostaną
   powiadomienia o decyzjach.
4. **Ustawienia → E-mail**: „Odbiorcy kart zmian w projekcie po komplecie
   decyzji” — ta lista dostaje PDF z kompletem decyzji i podpisów.

## 4. Obieg

1. Brygadzista (albo admin): **Zmiany → Nowa karta zmiany** → nazwa, plac
   (podpowiadany z dzisiejszego raportu rozpoczęcia), „Jest”, „Powinno być”
   (zdjęcia + opis, mikrofon), KNA, akceptujący (domyślnie wszyscy) → **Wyślij**.
   - Zdjęcia idą na serwer pojedynczo zaraz po zrobieniu; szkic karty zostaje
     na urządzeniu (IndexedDB) do skutecznej wysyłki.
   - Ponowne „Wyślij” po zerwanym połączeniu nie tworzy duplikatu ani
     drugiego maila.
2. Każdy akceptujący dostaje imienny mail z linkiem (ważny 14 dni) i PDF-em.
   Link → PIN → aplikacja z otwartą kartą. Ta przeglądarka jest odtąd
   autoryzowana — kolejne wejścia to zwykłe logowanie (wybór osoby + PIN).
3. Akceptujący: **Akceptuję / Odrzucam** → komentarz (obowiązkowy przy
   odrzuceniu) → **Złóż podpis** → **Wyślij decyzję**. Decyzja jest ostateczna,
   godzinę nadaje serwer.
4. Po każdej decyzji mail do autora i pozostałych akceptujących.
5. Pierwsza akceptacja blokuje treść karty. Do tego czasu autor może ją
   edytować — nowa wersja unieważnia oczekujące decyzje, oddane zostają
   w historii, akceptujący dostają nowe linki.
6. Komplet decyzji → status zbiorczy (Zaakceptowana / Odrzucona / Sporna),
   PDF z podpisami do archiwum i do listy odbiorców z Ustawień.

Akceptujący, który nie jest brygadzistą ani adminem, widzi w aplikacji
**wyłącznie** zakładkę „Zmiany w projekcie” (serwer nie oddaje mu też raportów
dziennych).

## 5. Test po wdrożeniu

1. Nadaj sobie (na koncie testowym) kompetencję + e-mail + PIN.
2. Z konta brygadzisty wyślij kartę z 2–3 zdjęciami → sprawdź mail i PDF.
3. Otwórz link w trybie prywatnym → PIN → karta się otwiera.
4. Odrzuć bez komentarza (przycisk nieaktywny), potem z komentarzem → status.
5. Jako autor zmień kartę → stary link pokazuje „Link wygasł”, nowy działa.
6. Zaakceptuj → „Edytuj kartę” znika, status/PDF się aktualizuje.
