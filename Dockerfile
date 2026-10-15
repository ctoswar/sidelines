# syntax=docker/dockerfile:1
#
# Sidelines production image — multi-stage, multi-arch (builds on the Pi).
#
#   docker compose build app
#   docker compose up -d app
#
# Migrations/seeds are deliberately NOT baked in (drizzle-kit is a devDep):
# run `npm run db:migrate && npm run db:seed` from a dev machine first.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Dependencies first, for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Emit .next/standalone: a self-contained server with only the traced
# production deps. Modules that read env at import time (db.ts throws
# without DATABASE_URL; Better Auth refuses to build in production
# without a secret) get placeholders here — postgres.js connects lazily
# and no prerendered page queries the database. Real values come from
# .env at runtime (env_file in docker-compose.yml) and always win.
ENV NEXT_OUTPUT_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://placeholder@127.0.0.1:5432/sidelines \
    BETTER_AUTH_SECRET=build-time-placeholder-0000000000000000
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone bundle, plus the assets it does not inline.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
