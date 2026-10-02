FROM node:24.21.0-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node db ./db
COPY --chown=node:node scripts ./scripts

USER node
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD wget -qO- http://127.0.0.1:4000/health/live >/dev/null || exit 1

CMD ["sh", "-c", "npm run migrate && node src/server.js"]