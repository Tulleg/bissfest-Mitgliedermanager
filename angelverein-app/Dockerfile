# ============================================
# Stage 1: Frontend bauen
# ============================================
FROM node:20-slim AS frontend-build

WORKDIR /app/client

# Client Dependencies installieren
COPY client/package.json client/package-lock.json ./
RUN npm ci

# Client Source kopieren und bauen
COPY client/ ./
RUN npm run build

# ============================================
# Stage 2: Production Server
# ============================================
FROM node:20-slim AS production

WORKDIR /app

# Server Dependencies installieren (Build-Tools für native Module: better-sqlite3, bcrypt)
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ su-exec && \
    npm ci --omit=dev && \
    apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Server-Code kopieren
COPY server/ ./server/
COPY config.json ./

# Frontend Build aus Stage 1 kopieren
COPY --from=frontend-build /app/client/dist ./client/dist

# Uploads-Ordner erstellen
RUN mkdir -p uploads data

# appuser anlegen (Entrypoint wechselt zur Laufzeit zu appuser)
RUN groupadd -r -g 1001 appgroup && \
    useradd -r -u 1001 -g appgroup appuser && \
    chown -R appuser:appgroup /app

# Entrypoint-Script kopieren und ausführbar machen
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Port
EXPOSE 3500

# Health Check (als appuser via su-exec gestartet)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3500/api/config', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start als root → Entrypoint setzt Berechtigungen → wechselt zu appuser
CMD ["./docker-entrypoint.sh"]
