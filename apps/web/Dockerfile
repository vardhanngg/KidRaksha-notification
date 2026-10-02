FROM node:24.21.0-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/api/package.json ./services/api/package.json

RUN npm ci --no-audit --no-fund

FROM node:24.21.0-alpine AS builder
WORKDIR /app

ARG API_INTERNAL_ORIGIN=http://localhost:4000
ENV API_INTERNAL_ORIGIN=$API_INTERNAL_ORIGIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build --workspace=@kidsuraksha/web

FROM node:24.21.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "apps/web/server.js"]
