# 🎣 Angelverein App – Deployment auf Proxmox

## Übersicht

Die App läuft als Docker-Container und wird über einen Cloudflare Tunnel erreichbar gemacht.

**Features:**
- 🔒 Login-System mit Benutzername & Passwort (bcrypt-gehasht)
- 🐳 Docker-Container (isoliert von anderen Diensten)
- 💾 Persistente Daten (SQLite-Datenbank + Uploads)
- 🔄 Automatischer Neustart bei Absturz

---

## Voraussetzungen

- Docker & Docker Compose auf dem Proxmox-Server (oder in einer VM/LXC)
- Git (zum Klonen des Repos)
- Cloudflare Tunnel (bereits eingerichtet)

---

## 1. Repo auf den Server bringen

```bash
# Option A: Git Clone
git clone <dein-repo-url> /opt/angelverein
cd /opt/angelverein/angelverein-app

# Option B: Dateien manuell kopieren (z.B. mit scp)
scp -r ./angelverein-app user@proxmox-ip:/opt/angelverein/
ssh user@proxmox-ip
cd /opt/angelverein
```

## 2. Konfiguration anpassen

Bearbeite `config.json` nach Bedarf:

```bash
nano config.json
```

- `vereinsname`: Name deines Vereins
- `port`: Standard ist 3500 (kann geändert werden)
- `spalten`: Felder für die Mitgliederverwaltung anpassen

## 3. Container starten

```bash
# Container bauen und starten
docker compose up -d

# Logs anschauen
docker compose logs -f

# Status prüfen
docker compose ps
```

Der Container läuft jetzt auf **Port 3500**.

## 4. Ersteinrichtung (Admin-Account)

1. Öffne `http://<server-ip>:3500` im Browser
2. Beim ersten Aufruf erscheint die **Ersteinrichtung**
3. Erstelle deinen **Admin-Account** (Benutzername + Passwort)
4. Du wirst automatisch eingeloggt

> ⚠️ **Wichtig:** Wähle ein sicheres Passwort (min. 6 Zeichen)!

## 5. Cloudflare Tunnel konfigurieren

In deinem Cloudflare Tunnel Dashboard:

1. Gehe zu **Access → Tunnels → Dein Tunnel → Configure**
2. Füge einen neuen **Public Hostname** hinzu:
   - **Subdomain:** z.B. `angelverein`
   - **Domain:** deine Domain
   - **Service:** `http://localhost:3500`
3. Speichern

Die App ist jetzt unter `https://angelverein.deine-domain.de` erreichbar.

---

## Verwaltung

### Container stoppen/starten
```bash
cd /opt/angelverein/angelverein-app

# Stoppen
docker compose down

# Starten
docker compose up -d

# Neustart
docker compose restart

# Neu bauen (nach Code-Änderungen)
docker compose up -d --build
```

### Logs anschauen
```bash
docker compose logs -f
docker compose logs --tail 50
```

### Datenbank-Backup
```bash
# Backup erstellen
docker cp angelverein-app:/app/data/angelverein.db ./backup-$(date +%Y%m%d).db

# Backup wiederherstellen
docker cp ./backup-20250305.db angelverein-app:/app/data/angelverein.db
docker compose restart
```

### Passwort vergessen?
Falls du dein Passwort vergessen hast, kannst du die Benutzer-Tabelle zurücksetzen:

```bash
# In den Container gehen
docker exec -it angelverein-app sh

# SQLite öffnen und Benutzer löschen
sqlite3 /app/data/angelverein.db "DELETE FROM benutzer;"

# Container verlassen
exit

# Container neustarten
docker compose restart
```

Beim nächsten Aufruf erscheint wieder die Ersteinrichtung.

### Config ändern
```bash
# Config bearbeiten
nano config.json

# Container neu bauen
docker compose up -d --build
```

Alternativ kannst du die Config als Volume mounten (in `docker-compose.yml` die auskommentierte Zeile aktivieren):
```yaml
volumes:
  - ./config.json:/app/config.json:ro
```

---

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `NODE_ENV` | `production` | Produktionsmodus |
| `TRUST_PROXY` | `true` | Für Reverse Proxy / Cloudflare Tunnel |
| `SESSION_SECRET` | (auto-generiert) | Session-Verschlüsselung. Wird automatisch generiert und in `/app/data/.session-secret` gespeichert. |

---

## Sicherheit

- ✅ **Passwörter** werden mit bcrypt (12 Runden) gehasht
- ✅ **Sessions** laufen nach 7 Tagen ab
- ✅ **HttpOnly Cookies** – kein JavaScript-Zugriff auf Session-Cookie
- ✅ **HTTPS** über Cloudflare Tunnel
- ✅ **Container** läuft als non-root User
- ✅ **Alle API-Routen** sind geschützt (außer Login/Setup)

### Empfehlungen
- Nutze ein **starkes Passwort** (min. 12 Zeichen empfohlen)
- Mache regelmäßige **Backups** der Datenbank
- Halte Docker und Node.js **aktuell**
