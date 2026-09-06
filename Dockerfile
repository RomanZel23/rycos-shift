# =============================================================================
# RYCOS Shift — obraz produkcyjny
#
# Ścieżka wdrożenia: Coolify (Build Pack: Dockerfile) z repo GitHub na VPS.
# docker-compose.yml w repo służy wyłącznie do ręcznego uruchomienia z pominięciem
# Coolify — przy buildzie z Dockerfile jego build.args NIE są używane.
#
# Zmienne w Coolify -> aplikacja -> Environment Variables:
#   Build Variable = TAK   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#   Build Variable = NIE   APP_ACCESS_CODE, GATE_SECRET,
#                          SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL
# Sekrety serwerowe celowo nie są ARG-ami — zostałyby na stałe w warstwie obrazu.
#
# Etap 3: baza zmieniona z alpine na bookworm-slim, bo PDF-y renderuje teraz
# Chromium po stronie serwera, a on wymaga glibc. Obraz jest przez to większy
# (ok. 400 MB), w zamian dokumenty mają prawdziwe łamanie stron, tekst zamiast
# rastra i stały zestaw krojów pisma niezależny od urządzenia użytkownika.
# =============================================================================

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
# pnpm-workspace.yaml niesie ignoredBuiltDependencies (sharp, unrs-resolver) —
# bez niego pnpm próbuje odpalać skrypty build tych paczek w obrazie.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Tylko NEXT_PUBLIC_* — Next inline'uje je do bundla w czasie builda,
# więc muszą być znane TERAZ, a nie dopiero w runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Chromium do generowania PDF + kroje pisma z polskimi znakami.
# puppeteer-core NIE pobiera własnej przeglądarki — używa tej systemowej.
# Stopka papieru firmowego jest złożona krojem Arial Narrow, a Liberation Sans
# Narrow to jego metrycznie zgodny zamiennik. Bez niego Chromium podstawia
# zwykły Liberation Sans, linie stopki robią się o kilkadziesiąt milimetrów
# szersze i dokument przestaje odpowiadać wzorcowi.
#
# Ten krój bywa w różnych pakietach: Debian trzyma go w fonts-liberation
# (Liberation 1.x, która ma odmiany Narrow), Ubuntu przeniosło fonts-liberation
# na Liberation 2.x — gdzie odmian Narrow już nie ma — i wydzieliło je do
# osobnego fonts-liberation-sans-narrow. Próbujemy więc obu dróg i nie
# wywracamy builda na nazwie pakietu; o to, czy plik faktycznie jest,
# pyta sprawdzenie niżej.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-dejavu-core \
      fontconfig \
      ca-certificates \
 && (apt-get install -y --no-install-recommends fonts-liberation-sans-narrow || true) \
 && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Chromium potrzebuje zapisywalnego HOME i katalogu na profil oraz zrzuty
# awaryjne. Bez tego proces `chrome_crashpad_handler` dostaje puste `--database`
# i przewraca całą przeglądarkę przy starcie — awaria z 2026-09-05, przez którą
# nie dało się złożyć ani jednego raportu. Szczegóły w src/lib/pdf-renderer.ts.
ENV HOME=/home/nextjs
ENV CHROMIUM_WORK_DIR=/home/nextjs/chromium
RUN mkdir -p /home/nextjs/chromium \
 && chown -R nextjs:nodejs /home/nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Kroje pisma z repozytorium do systemu.
#
# Exo 2 to krój z księgi znaku SolutionsBay (docs/CI_SolutionsBay_2020.pdf) —
# używa go i portal, i treść raportów. Liberation Sans Narrow zastępuje Arial
# Narrow w stopce papieru firmowego; bez niego linie stopki robią się o ok.
# 20 mm szersze niż na wzorcu.
#
# Trzymamy je w repozytorium zamiast polegać na pakietach dystrybucji: nazwy
# pakietów różnią się między Debianem a Ubuntu (na tym wyłożył się build
# 2026-09-06), a Exo 2 nie ma w repozytoriach Debiana w ogóle. Przeglądarka
# renderująca PDF ma odciętą sieć, więc krój musi być w obrazie.
# Licencje leżą obok plików: OFL dla Exo 2, GPL+FE dla Liberation.
RUN mkdir -p /usr/share/fonts/truetype/rycos \
 && cp ./public/fonts/*.ttf /usr/share/fonts/truetype/rycos/ \
 && fc-cache -f > /dev/null \
 && echo "Kroje wgrane: $(ls /usr/share/fonts/truetype/rycos | wc -l)"

USER nextjs

# Sprawdzenie przy budowaniu obrazu, że Chromium W OGÓLE WSTAJE na tym
# użytkowniku i z tymi katalogami. `apt-get install chromium` nie jest przypięty
# do wersji, więc każda przebudowa może przynieść inną. Lepiej, żeby Coolify
# pokazał czerwony build, niż żeby brygadzista dowiedział się o tym na budowie
# po wypełnieniu całej odprawy.
RUN chromium --headless --no-sandbox --disable-gpu \
      --user-data-dir=/home/nextjs/chromium/profile \
      --crash-dumps-dir=/home/nextjs/chromium/crashes \
      --disable-crash-reporter --disable-breakpad \
      --dump-dom about:blank > /dev/null \
 && echo "Chromium OK"

# Kroje pisma. Sprawdzamy przy budowaniu, bo ich brak nie wywala renderowania
# — po cichu psuje układ dokumentu, a widać to dopiero na wydruku u klienta.
# Pytamy fontconfig o rodzinę, a nie o ścieżkę pliku: liczy się to, co naprawdę
# zobaczy Chromium.
RUN for rodzina in "Exo 2" "Liberation Sans Narrow"; do \
      znaleziona=$(fc-match "$rodzina" family); \
      case "$znaleziona" in \
        *"$rodzina"*) echo "Krój OK: $rodzina" ;; \
        *) echo "BLAD: brak kroju '$rodzina' — fontconfig podstawia '$znaleziona'."; \
           echo "      Sprawdz public/fonts/ w repozytorium i krok kopiujacy kroje wyzej."; \
           exit 1 ;; \
      esac; \
    done

EXPOSE 3000

# /api/health jest poza bramką Etapu 0, więc healthcheck działa bez kodu dostępu.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
