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
# =============================================================================

FROM node:22-alpine AS base
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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# /api/health jest poza bramką Etapu 0, więc healthcheck działa bez kodu dostępu.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/api/health > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
