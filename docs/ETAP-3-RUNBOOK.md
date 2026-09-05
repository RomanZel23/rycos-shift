# Etap 3 — renderowanie PDF po stronie serwera

Wdrażane po Etapach 2 i 2b. **Bez migracji SQL** — zmiany są wyłącznie w kodzie
i w obrazie Dockera. Jest natomiast jeden krok, który musisz wykonać lokalnie
przed pushem (punkt 1).

---

## Dlaczego

Stary generator składał strony ręcznie: sztywne kontenery 794×1123 px,
`overflow: hidden`, wysokości policzone pod jeden krój pisma, a html2canvas
zamieniał każdą stronę w obrazek. Zmierzone skutki:

| pracowników na liście | trafiało do dokumentu | ginęło bez śladu |
|---|---|---|
| 8 | 8 | 0 |
| 12 | 9 | **3** |
| 30 | 9 | **21** |

Do tego układ rozjeżdżał się między maszynami, bo tekst rysowany był według
metryk czcionek konkretnego urządzenia — stąd dwie nieudane próby poprawienia
opisów pod zdjęciami, z których każda działała na jednym komputerze.

## Co jest teraz

Dokument to płynący HTML, a strony łamie Chromium przez CSS paged media.

| | stary silnik | nowy silnik |
|---|---|---|
| Limit listy obecności | 9 osób | brak |
| 30 osób | 1 strona, 21 nazwisk ginie | 2 strony, komplet |
| 60 osób | 1 strona, 51 nazwisk ginie | 3 strony, komplet |
| Rozmiar pliku | 402–550 kB (raster, 1 strona) | 180 kB (30 osób, 2 strony) |
| Tekst | obrazek | przeszukiwalny, kroje osadzone |
| Kto renderuje | telefon w terenie na LTE | serwer, ~170 ms |
| Nagłówek tabeli na kolejnych stronach | — | powtarzany automatycznie |
| Numeracja stron | — | „Strona X z Y" w stopce |

Sprawdzone `pdftotext`: przy 60 pracownikach w tekście dokumentu jest 60 nazwisk,
ostatnie to „Pracownik Numer 60". Polskie znaki zachowane, kroje osadzone w pliku.

## 1. Nowa zależność — zrób to przed pushem

```bash
cd ~/Projects/rycos-shift
pnpm add puppeteer-core
git add package.json pnpm-lock.yaml
```

`puppeteer-core` **nie pobiera własnej przeglądarki** — używa Chromium
zainstalowanego w obrazie. Bez zaktualizowanego lockfile'a build w Coolify
padnie, bo Dockerfile instaluje z `--frozen-lockfile`.

## 2. Obraz Dockera

Baza zmieniona z `node:22-alpine` na `node:22-bookworm-slim` — Chromium wymaga
glibc, a na Alpine to droga przez mękę. Doinstalowane: `chromium`,
`fonts-liberation`, `fonts-dejavu-core`.

Obraz urośnie do ok. 400 MB i pierwszy build w Coolify potrwa dłużej.
Kolejne korzystają z cache warstw APT.

Healthcheck przepisany z `wget` na `node -e fetch(...)`, bo bookworm-slim nie
ma wgeta.

## 3. Zmienne środowiskowe

Nic nowego. `CHROMIUM_PATH` ustawia sam Dockerfile na `/usr/bin/chromium`;
zmienna istnieje, gdybyś kiedyś chciał wskazać inną binarkę.

## 4. Deploy i test dymny

1. Złóż raport rozpoczęcia prac z **12 osobami na liście**. Wcześniej trzy
   ostatnie podpisy znikały. Teraz dokument ma tyle stron, ile trzeba, a na
   drugiej powtarza się nagłówek tabeli.
2. Otwórz PDF i spróbuj **zaznaczyć tekst oraz użyć Cmd+F**. Wcześniej to był
   obrazek. Teraz nazwiska da się wyszukać.
3. Sprawdź stopkę: „Strona 1 z 2".
4. Fotorelacja z 9 zdjęciami — długie opisy mają być w całości, karta rośnie
   zamiast przycinać.
5. Archiwum → **Pobierz** na nowym raporcie: plik ma być identyczny z tym,
   który przyszedł mailem (ta sama suma kontrolna).

## 5. Co zniknęło z aplikacji

- **Zakładka „Szablony PDF"** w Ustawieniach. Zapisywała `html_content` do bazy,
  ale generator nigdy z niego nie korzystał — administrator edytował szablon bez
  wpływu na jakikolwiek dokument. Tabela `pdf_templates` zostaje w bazie na
  wypadek powrotu funkcji.
- **Generowanie PDF w przeglądarce.** `src/lib/pdf-generator.ts` skurczył się
  z 358 linii do sanityzatora nazw plików.
- **Regeneracja przy pobieraniu.** Przycisk „Pobierz" w Archiwum i na ekranie
  sukcesu oddaje teraz zarchiwizowany plik — ten sam, który poszedł mailem.
  Dla protokołu z podpisami to różnica dowodowa, nie kosmetyczna.

## 6. Bezpieczeństwo renderera

Chromium renderujący dokument ma **wyłączony JavaScript** i **zablokowaną sieć**
(przechodzi tylko sam dokument i obrazy `data:`). Wszystkie zdjęcia i podpisy są
wstawiane jako data URL przez `src/lib/pdf-assets.ts`, zanim HTML trafi do
przeglądarki. Dzięki temu renderer nie potrzebuje ciasteczka sesji, nie zależy od
dostępności bucketu i nie da się z niego zrobić narzędzia do odpytywania
zasobów wewnętrznych.

Instancja przeglądarki jest jedna na proces i podnosi się sama, gdyby padła.
Pierwszy raport po starcie kontenera trwa ok. 0,5 s, kolejne ok. 170 ms.

---

## Czego Etap 3 NIE naprawia

- **Zdjęcia nadal jadą jako base64** w ciele żądania do `/api/reports`. PDF już
  nie jedzie w ogóle, więc żądanie mocno schudło, ale przy kilkunastu zdjęciach
  wciąż jest spore. Przeniesienie ich na osobne party multipart to Etap 2b.
- **Kolejka offline dalej w localStorage** i dosyła raporty bez maila. Etap 2b.
- **Martwe zależności**: `jspdf`, `jspdf-autotable`, `html2canvas` nie są już
  nigdzie importowane. Razem z `clsx`, `tailwind-merge`, `react-signature-canvas`
  i Prismą do usunięcia w Etapie 4 — to zauważalnie odchudzi bundle.
