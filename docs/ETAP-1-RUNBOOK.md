# Etap 1 — runbook wdrożenia (autentykacja użytkowników)

Zakłada wdrożony Etap 0. Kolejność: migracja SQL → redeploy → nadanie haseł zespołowi.

---

## Co się zmienia

Do tej pory logowanie było fikcją: hasło sprawdzała przeglądarka, na liście kont
pobranej z API, a `password123`, `admin` i `1234` działały na każde konto.
Teraz poświadczenia weryfikuje wyłącznie serwer, hasła są hashowane (scrypt),
a sesja żyje w podpisanym ciasteczku httpOnly.

Trzy warstwy przed każdym `/api/*`:

1. `/api/health`, `/api/gate` — otwarte.
2. `/api/auth/*` — tylko bramka urządzenia (inaczej nie dałoby się zalogować).
3. reszta — bramka **i** ważna sesja. Operacje administracyjne dodatkowo
   sprawdzają `is_admin` już w route handlerze, nie tylko w proxy.

---

## 1. Migracja SQL

Supabase → SQL Editor → `supabase/migrations/0002_etap1_auth.sql`.

Dodaje `password_hash`, `pin_hash`, `failed_login_attempts`, `locked_until`,
`last_login_at`, `session_epoch`, zakłada unikalny indeks na `lower(login)`
i **kasuje kolumnę `password`** z hasłami plaintext.

Na końcu pliku są trzy zapytania weryfikacyjne — uruchom je po migracji.

> Jeśli zapytanie 3c pokaże duplikaty loginu, indeks unikalny nie powstanie
> i migracja przerwie się w tym miejscu. Popraw loginy i uruchom ponownie.

## 2. Hasło startowe administratora

> **Wykorzystane i nieaktualne.** Hasło startowe zostało użyte przy wdrożeniu
> 2026-09-05 i od razu zmienione, dlatego nie ma go w tym pliku — plaintextowe
> poświadczenie nie ma czego szukać w repozytorium. Hash w migracji `0002` jest
> już tylko zapisem historycznym.

Migracja wpisuje hash hasła dla konta `usr-admin-1` (`m.bajda`). To jedyne konto,
które po migracji ma jakiekolwiek poświadczenia — od niego zaczyna się nadawanie
haseł i PIN-ów reszcie zespołu.

Gdybyś odtwarzał środowisko od zera, wygeneruj nowe hasło i jego hash:

```bash
node -e '
const {randomBytes,scryptSync}=require("crypto");
const pw=process.argv[1]; const salt=randomBytes(16);
const h=scryptSync(pw.normalize("NFKC"),salt,32,{N:65536,r:8,p:1,maxmem:167772160});
console.log(`scrypt$65536$8$1$${salt.toString("base64")}$${h.toString("base64")}`);
' "TwojeNoweHaslo123"
```

i podmień wartość w `update public.users set password_hash = ...`.

## 3. Zmienne środowiskowe

Nic nowego **nie jest wymagane** — podpis sesji domyślnie korzysta z `GATE_SECRET`,
który już masz, wyprowadzając z niego osobny klucz przez etykietę, żeby sesje
i bramka urządzenia nie dzieliły materiału kryptograficznego.

Opcjonalnie możesz rozdzielić je całkiem, dodając w Coolify (bez „Build Variable"):

```
SESSION_SECRET=<openssl rand -hex 32>
```

Zmiana `SESSION_SECRET` (albo `GATE_SECRET`, gdy go używasz) unieważnia sesje
wszystkich zalogowanych.

## 4. Redeploy

Coolify → Redeploy. Potem test dymny:

```bash
curl -s  https://shift.rycos.eu/api/health          # 200, {"gate":true,"supabase":true}
curl -i  https://shift.rycos.eu/api/db/sync         # 401 GATE_LOCKED (bez ciasteczek)
```

W przeglądarce, po wpisaniu kodu urządzenia, ale **przed** zalogowaniem:

```
/api/db/sync    -> 401, "code":"UNAUTHENTICATED"
/api/auth/roster-> 200, lista imion i nazwisk bez loginów
```

## 5. Nadanie poświadczeń zespołowi

Zaloguj się jako `m.bajda` (tryb „Login i Hasło"), wejdź w **Ustawienia → Użytkownicy**.
Przy każdej osobie są teraz dwa przyciski:

- **Poświadczenia** — nadaje hasło (min. 10 znaków, litery i cyfry) i/lub PIN (4–8 cyfr).
  Wartości są w polu widoczne, żeby dało się je przepisać pracownikowi; serwer
  zapisuje wyłącznie hash i nie da się ich później odczytać. Zapis unieważnia
  aktywne sesje tej osoby.
- **Odblokuj** — zdejmuje blokadę po pięciu nieudanych próbach logowania.

Brygadzistom wystarczy PIN — logują się kafelkiem w trybie „Wybór Pracownika".
Hasło potrzebne jest tylko tam, gdzie ktoś korzysta z trybu „Login i Hasło".

Do czasu nadania poświadczeń konto po prostu się nie zaloguje — kafelek osoby
bez PIN-u jest wyszarzony i podpisany „Brak PIN-u".

---

## Decyzje projektowe warte zapamiętania

**Dlaczego nie Supabase Auth.** Po Etapie 0 przeglądarka nie łączy się już z Supabase —
wszystko idzie przez serwer na service_role. Główna korzyść Supabase Auth, czyli
polityki RLS po `auth.uid()`, jest więc niewykorzystana, a kosztem byłyby fikcyjne
adresy e-mail dla pracowników, którzy mają loginy typu `m.bajda`.

**Dlaczego scrypt, a nie argon2id.** `argon2` z npm wymaga kompilacji natywnej,
co na `node:alpine` bywa kruche, a każda nowa zależność wymusza przebudowę
lockfile'a — Dockerfile instaluje z `--frozen-lockfile`. Scrypt jest wbudowany
w Node, to RFC 7914 akceptowany przez OWASP. Parametry: N=2^16, r=8, p=1,
ok. 200 ms na weryfikację.

**Dlaczego sesje bez tabeli.** Podpis HMAC weryfikuje się bez zapytania do bazy,
więc proxy odsiewa anonimowy ruch, zanim cokolwiek dotknie Supabase. Unieważnianie
załatwia `session_epoch` na użytkowniku: route handlery i tak czytają użytkownika
z bazy, więc porównanie epoki nic nie kosztuje. Zmiana hasła, PIN-u lub odblokowanie
konta podnosi epokę i wywala wszystkie stare ciasteczka.

**Dlaczego proxy nie wystarcza.** Proxy sprawdza tylko podpis ciasteczka. Konto
mogło zostać w międzyczasie usunięte albo stracić uprawnienia, więc każdy route
wywołuje `requireUser`/`requireAdmin`, które porównują stan z bazą. Dokumentacja
Next mówi o tym wprost przy okazji Server Functions.

---

## Czego Etap 1 NIE naprawia

- `/api/send-report` nadal przyjmuje listę odbiorców i klucz Resend z body żądania.
  Jest już za sesją, więc nie jest otwartym relayem, ale zalogowany pracownik wciąż
  może wysłać raport na dowolny adres. **Etap 2.**
- Ekran sukcesu nadal mówi „wysłano", gdy mail nie poszedł. **Etap 2.**
- Raport porannny nadal nie ma paginacji i ucina długie listy obecności. **Etap 3.**
- Nie ma samodzielnego resetu hasła ani MFA — poświadczenia nadaje administrator.
