# Angelverein-App – Mitgliederverwaltung

Eine vollständige Verwaltungssoftware für Angelvereine mit Mitgliederverwaltung, Import/Export und PDF-Generierung.

![Status](https://img.shields.io/badge/status-production--ready-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-20+-green)
![React](https://img.shields.io/badge/react-18+-blue)

---

## 🎯 Features

- **👥 Mitgliederverwaltung** – Flexible Spalten, konfigurierbar via JSON
- **📥 Import** – PDF (mit OCR) und Excel-Dateien importieren
- **📤 Export** – Anpassbare PDF-Templates für Berichte und Meldungen
- **🔐 Authentifizierung** – Sichere Anmeldung mit bcrypt-Hashing
- **🌐 Web-Interface** – Modernes UI mit React & Tailwind CSS
- **🐳 Docker-ready** – Produktionsbereit mit Docker Compose
- **⚙️ Konfigurierbar** – Alle Spalten, Vorlagen und Einstellungen in `config.json`

---

## 🛠 Tech Stack

| Component | Technologie |
|-----------|-------------|
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **Backend** | Node.js + Express 4 |
| **Datenbank** | SQLite (better-sqlite3) |
| **PDF** | PDFKit (Export), pdf-parse (Import) |
| **Excel** | xlsx (SheetJS) |
| **Deployment** | Docker + Docker Compose |

---

## 🚀 Schnellstart – Entwicklung

### Anforderungen
- Node.js 20+ 
- npm oder yarn

### Installation

```bash
# Projekt klonen
git clone https://github.com/deinusername/angelverein-app.git
cd angelverein-app

# Frontend & Backend installieren
npm install
cd client && npm install && cd ..

# .env konfigurieren (optional)
cp .env.example .env

# config.json anpassen (Vereinsname, Spalten, Vorlagen)
cp config.json.example config.json
nano config.json
```

### Entwicklungsserver starten

```bash
# Frontend + Backend parallel (mit concurrently)
npm run dev
```

Oder einzeln:
```bash
# Terminal 1: Backend (Port 3500)
npm run server

# Terminal 2: Frontend (Port 5173)
npm run client
```

**Zugriff:** http://localhost:5173

### Erste Anmeldung

1. Öffne http://localhost:5173 im Browser
2. Der erste Benutzer wird automatisch als Admin erstellt
3. Benutzername/Passwort vergeben
4. Anmelden und Mitglieder verwalten

---

## 📦 Production Deployment

### Mit Docker Compose

```bash
# Repository ins Deployment-Verzeichnis klonen
cd /opt/angelverein
git clone https://github.com/deinusername/angelverein-app.git .

# config.json anpassen
nano angelverein-app/config.json

# Services starten
docker compose up -d

# Logs prüfen
docker compose logs -f
```

**URL:** http://localhost:3500 (via Reverse Proxy oder Tunnel)

### Umgebungsvariablen

Für Production in `.env` oder im `docker-compose.yml` setzen:

```env
NODE_ENV=production
TRUST_PROXY=true
SESSION_SECRET=dein-sicherer-zufälliger-string  # Optional, wird auto-generated
PORT=3500
```

### Persistente Speicherung

Docker Compose verwendet zwei Volumes:
- `angelverein-data` – Datenbank, Session-Secrets
- `angelverein-uploads` – Hochgeladene Dateien

Diese bleiben auch nach `docker compose down` erhalten.

---

## ⚙️ Konfiguration

Die `config.json` definiert das komplette Verhalten:

### Beispiel `config.json`

```json
{
  "vereinsname": "Angelverein Musterstadt e.V.",
  "port": 3500,
  "spalten": [
    { "key": "mitgliedsnummer", "label": "Mitgliedsnr.", "type": "text", "required": true },
    { "key": "vorname", "label": "Vorname", "type": "text", "required": true },
    { "key": "nachname", "label": "Nachname", "type": "text", "required": true },
    { "key": "geburtsdatum", "label": "Geburtsdatum", "type": "date", "required": false },
    { "key": "status", "label": "Status", "type": "select", "options": ["aktiv", "passiv", "ausgetreten"], "required": true }
  ],
  "exportVorlagen": [
    {
      "name": "Verbandsmeldung",
      "ueberschrift": "Mitgliedermeldung an den Verband",
      "felder": ["mitgliedsnummer", "vorname", "nachname", "status"],
      "filter": { "status": "aktiv" },
      "zeigeAnzahl": true,
      "zeigeDatum": true
    }
  ]
}
```

### Feldtypen

- `text` – Freitextfeld
- `date` – Datumfeld (YYYY-MM-DD)
- `email` – E-Mail-Feld mit Validierung
- `boolean` – Ja/Nein Checkbox
- `select` – Dropdown mit vordefinierten Optionen

ℹ️ Weitere Details: [Siehe config.json.example](angelverein-app/config.json.example)

---

## 📚 Dokumentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** – Detaillierte Deployment-Anleitung
- **[status.md](status.md)** – Aktueller Projektstatus
- **[CONTRIBUTING.md](CONTRIBUTING.md)** – Richtlinien für Entwickler

---

## 🔒 Sicherheit

- Passwörter werden mit bcrypt gehashed (Salt: 10 Runden)
- Session-Secrets werden sicher gespeichert und nicht in der Repo commitet
- CORS ist konfigurierbar
- Express.js Best Practices für Session-Management

---

## 📋 Lizenz

MIT License – siehe [LICENSE](LICENSE) (falls vorhanden)

---

## 💬 Support & Kontakt

Fragen oder Fehler?
- Erstelle ein [GitHub Issue](https://github.com/deinusername/angelverein-app/issues)
- oder kontaktiere den Projektmaintainer

---

**Viel Spaß mit der Angelverein-App! 🎣**
