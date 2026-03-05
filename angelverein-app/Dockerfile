# ============================================
# Stage 1: Frontend bauen
# ============================================
FROM node:20-alpine AS frontend-build

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
FROM node:20-alpine AS production

# Python und Build-Tools für native Module (better-sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Server Dependencies installieren
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Server-Code kopieren
COPY server/ ./server/
COPY config.json ./

# Frontend Build aus Stage 1 kopieren
COPY --from=frontend-build /app/client/dist ./client/dist

# Uploads-Ordner erstellen
RUN mkdir -p uploads data

# Nicht als root laufen
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

# Port
EXPOSE 3500

# Health Check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3500/api/config || exit 1

# Start
CMD ["node", "server/index.js"]
