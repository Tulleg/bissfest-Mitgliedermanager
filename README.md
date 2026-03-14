# Bissfest-App – Mitgliederverwaltung

Eine vollständige Verwaltungssoftware für Angelvereine mit Mitgliederverwaltung, Fischverwaltung, Import/Export und rollenbasiertem Benutzersystem.

![Version](https://img.shields.io/badge/version-0.1.8--beta-orange)
![Status](https://img.shields.io/badge/status-beta-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-20+-green)
![React](https://img.shields.io/badge/react-18+-blue)

---

## 🎯 Features

- **👥 Mitgliederverwaltung** – Flexible Spalten, vollständig konfigurierbar via `config.json`
- **📊 Dashboard** – Übersicht mit Mitgliederstatistiken und aktuellem Fisch des Jahres
- **🐟 Fischverwaltung** – Fisch des Jahres (Jugend & Erwachsene) mit automatischer 3-Jahres-Sperre
- **📥 Import** – PDF (mit OCR) und Excel-Dateien importieren inkl. Reconciliation/Merge
- **📤 Export** – Anpassbare PDF-Templates mit Deckblatt, Filterinfo und Datum/Anzahl-Kopfzeile
- **🔐 Rollenbasiertes Rechtesystem** – admin / editor / viewer mit feingranularer API-Absicherung
- **👤 Benutzerverwaltung** – Benutzer anlegen, Rollen vergeben, löschen (Admin-Panel)
- **📱 Mobil-optimiert** – Responsives UI mit React & Tailwind CSS
- **🐳 Docker-ready** – Produktionsbereit mit Dockerfile & Docker Compose
- **⚙️ Konfigurierbar** – Alle Spalten, Feldtypen, Export-Vorlagen und Einstellungen in `config.json`

---

## 🛠 Tech Stack

| Component | Technologie |
|-----------|-------------|
| **Frontend** | React 18 + Vite 5 + Tailwind CSS 3 |
| **Backend** | Node.js 20+ + Express 4 |
| **Datenbank** | SQLite (better-sqlite3) |
| **Auth** | bcrypt + express-session |
| **PDF** | PDFKit (Export), pdf-parse (Import/OCR) |
| **Excel** | xlsx (SheetJS) |
| **Tests** | Jest + Supertest |
| **Deployment** | Docker + Docker Compose |

---

## 🚀 Schnellstart – Entwicklung

### Anforderungen

- Node.js 20+
- npm

### Installation & Start

```bash
# Repository klonen
git clone https://github.com/deinusername/angelverein-app.git
cd angelverein-app/angelverein-app

# Abhängigkeiten installieren (Backend + Frontend)
npm install

# config.json anpassen (Vereinsname, Spalten, Export-Vorlagen)
nano config.json

# Entwicklungsserver starten (Frontend :5173 + Backend :3500 parallel)
npm run dev
```

Oder in getrennten Terminals:

```bash
# Terminal 1: Backend (Port 3500)
npm run server

# Terminal 2: Frontend (Port 5173)
npm run client
```

**Zugriff:** http://localhost:5173

### Erste Anmeldung

1. Browser öffnen → http://localhost:5173
2. Beim ersten Start erscheint das Setup-Formular
3. Admin-Benutzername und Passwort vergeben
4. Anmelden – die App ist einsatzbereit

---

## 📦 Produktionsbetrieb mit Docker

```bash
cd angelverein-app

# config.json anpassen (Vereinsname, Spalten, etc.)
nano config.json

# Services starten
docker compose up -d

# Logs prüfen
docker compose logs -f
```

**URL:** http://localhost:3500 (direkt oder via Reverse Proxy/Tunnel)

### Umgebungsvariablen

In `.env` oder im `docker-compose.yml` setzen:

```env
NODE_ENV=production
PORT=3500
TRUST_PROXY=true         # hinter Nginx/Caddy/Traefik
SESSION_SECRET=...       # optional, wird auto-generiert
SECURE_COOKIE=true       # für HTTPS-Produktivbetrieb
```

### Persistente Speicherung

Docker Compose verwendet zwei Volumes, die auch nach `docker compose down` erhalten bleiben:

- `angelverein-data` – SQLite-Datenbanken, Session-Secret
- `angelverein-uploads` – hochgeladene Dateien

---

## 👥 Benutzerrollen

| Rolle | Rechte |
|-------|--------|
| **admin** | Vollzugriff: Benutzerverwaltung, Import, Export-Vorlagen, Fischverwaltung |
| **editor** | Mitglieder anlegen / bearbeiten / löschen, Dashboard, Export |
| **viewer** | Nur lesen: Mitgliederliste, Dashboard, Export-Ansicht |

---

## ⚙️ Konfiguration

Die `config.json` steuert das gesamte Verhalten der App:

```json
{
  "vereinsname": "Angelverein Musterstadt e.V.",
  "port": 3500,
  "spalten": [
    { "key": "mitgliedsnummer", "label": "Mitgliedsnr.", "type": "text", "required": true },
    { "key": "vorname",         "label": "Vorname",      "type": "text", "required": true },
    { "key": "nachname",        "label": "Nachname",     "type": "text", "required": true },
    { "key": "geburtsdatum",    "label": "Geburtsdatum", "type": "date", "required": false },
    { "key": "status",          "label": "Status",       "type": "select",
      "options": ["aktiv", "passiv", "ausgetreten"],     "required": true }
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

| Typ | Beschreibung |
|-----|-------------|
| `text` | Freitextfeld |
| `date` | Datumsfeld (YYYY-MM-DD) |
| `email` | E-Mail mit Validierung |
| `boolean` | Ja/Nein Checkbox |
| `select` | Dropdown mit vordefinierten Optionen |

---

## 🔒 Sicherheit

- Passwörter werden mit **bcrypt** gehasht (10 Salt-Runden)
- Session-Secrets werden sicher im `data/`-Verzeichnis gespeichert und nicht ins Repository commitet
- Alle API-Routen sind durch `requireAuth` geschützt, sensible Routen zusätzlich durch `requireRole`
- CORS ist konfigurierbar

---

## 📋 Lizenz

MIT License – siehe [LICENSE](LICENSE)

---

## 💬 Support & Kontakt

Fragen oder Fehler? Erstelle ein [GitHub Issue](https://github.com/deinusername/angelverein-app/issues).

---

🔒 Datenschutz & DSGVO-Hinweise
Diese Software speichert personenbezogene Daten (Mitgliederdaten). Der Betreiber ist gemäß DSGVO Art. 4 Nr. 7 selbst verantwortlich für den datenschutzkonformen Betrieb.
Pflichten des Betreibers
HTTPS ist zwingend erforderlich.
Ohne verschlüsselte Verbindung dürfen keine personenbezogenen Daten übertragen werden. Empfohlene Lösungen:

Caddy – automatisches Let's Encrypt, minimale Konfiguration
Nginx + Certbot
Cloudflare Tunnel

Weitere Betreiberpflichten:

Verarbeitungsverzeichnis nach Art. 30 DSGVO führen
Auftragsverarbeitungsvertrag (AVV) mit dem Hoster abschließen
Regelmäßige Backups der Datenbank (data/-Verzeichnis)
Zugriff auf den Server auf autorisierte Personen beschränken

Haftungsausschluss
Diese Software wird unter der MIT-Lizenz bereitgestellt. Der Entwickler übernimmt keine Haftung für datenschutzrechtliche Verstöße die durch unsachgemäßen Betrieb entstehen.

---

**Tight Lines! 🎣**
