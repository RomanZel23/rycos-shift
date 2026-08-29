# RYCOS Shift – System Raportów Terenowych

Dedykowany, zoptymalizowany pod urządzenia mobilne (smartfony, iPhone, tablety, iPad) system raportowania dziennego dla zespołów **SB Technology / SolutionsBay** (oddział Poznań) z możliwością rozszerzania na kolejne instancje, generalnych wykonawców i podwykonawców.

---

## 📱 Główne Funkcjonalności

1. **Raport dzienny – Rozpoczęcie prac zespołu (Odprawa BHP & Lista Obecności):**
   - Automatyczna data i godzina otwarcia.
   - Wybór Placu Budowy (*Poznań - Piątkowo*, *Poznań - Franowo* itd.).
   - Wybór Brygadzisty prowadzącego.
   - Automatyczny odczyt współrzędnych GPS (szerokość i długość geograficzna).
   - **Omawiane obszary (BHP / Zakres robót):**
     - Wpisanie ręczne
     - Szybki wybór ze zdefiniowanych szablonów
     - **Wprowadzanie głosowe (mikrofon / Web Speech API)**
   - **Lista obecności z podpisami dotykowymi:**
     - Dedykowany modal dla Brygadzisty
     - Modal dla Pracowników z listą wyboru
     - Canvas do podpisu palcem / rysikiem z blokadą przewijania (`touch-action: none`)
     - Aktywacja przycisku „OK” wyłącznie po złożeniu czytelnego podpisu
   - **Wysyłka i generowanie:**
     - Generowanie eleganckiego PDF z zachowaniem szablonu SB Technology, GPS i formuły `[Koniec raportu]`
     - Format pliku: `RRRR.MM.DD_Rozpoczęcie prac zespołu_[PlacBudowy].pdf`
     - Wysyłka e-mail za pośrednictwem Resend API na skonfigurowaną listę odbiorców.

2. **Raport dzienny – Zakończenie prac zespołu (Dokumentacja Fotograficzna):**
   - Wybór placu, brygadzisty, data, godzina, GPS.
   - Wywołanie natywnego aparatu w smartfonie (`capture="environment"`) lub wybór z galerii.
   - Kompresja zdjęć w przeglądarce przed wysłaniem (oszczędność transferu LTE).
   - Opis zdjęć wprowadzany ręcznie lub dyktowany głosem.
   - Dowolna liczba zdjęć z opisami w układzie siatki.
   - Format pliku: `RRRR.MM.DD_Zakończenie prac zespołu_[PlacBudowy].pdf`.

3. **Archiwum Raportów (Repozytorium):**
   - Przeglądanie wygenerowanych raportów.
   - Wyszukiwarka i filtrowanie po placu, dacie i typie.
   - Szybki podgląd i pobieranie plików PDF.

4. **Panel Administracyjny (Ustawienia – tylko dla Admina):**
   - Zarządzanie użytkownikami (Imię, Nazwisko, Rola, checkbox Brygadzista, checkbox Admin, Login, Hasło).
   - Zarządzanie placami budów (CRUD).
   - Zarządzanie szablonami omawianych obszarów / tematów BHP.
   - Konfiguracja list mailingowych dla rozpoczęcia i zakończenia prac.
   - Konfiguracja klucza Resend API i nadawcy.
   - Konfiguracja instancji (Multi-Tenant).

---

## 🚀 Uruchomienie Lokalne

1. Zainstaluj zależności:
   ```bash
   pnpm install
   ```

2. Uruchom serwer deweloperski:
   ```bash
   pnpm dev
   ```

3. Otwórz [http://localhost:3000](http://localhost:3000) w przeglądarce (lub w narzędziach deweloperskich w trybie symulacji iPhone / iPad / Android).

---

## 🌐 Wdrożenie (Deployment)

### Vercel:
1. Połącz repozytorium z kontem na [Vercel](https://vercel.com).
2. Dodaj zmienne środowiskowe:
   - `RESEND_API_KEY`: Twój klucz API z [resend.com](https://resend.com)
   - `RESEND_FROM_EMAIL`: (opcjonalnie) zweryfikowana domena nadawcy, np. `raporty@solutionsbay.pl` lub `onboarding@resend.dev`
3. Kliknij **Deploy**.

### Własny VPS (Docker):
```bash
docker compose up -d --build
```
Aplikacja uruchomi się na porcie `3000`.
