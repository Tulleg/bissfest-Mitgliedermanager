# Contributing zu Angelverein-App

Vielen Dank, dass du zu diesem Projekt beitragen möchtest! 🎣

Diese Richtlinien helfen uns, ein hohes Qualitätsniveau zu halten und zusammenzuarbeiten.

---

## 🚀 Neue Entwickler

### 1. Fork & Clone

```bash
# Fork auf GitHub (Web-UI)
# Dann local klonen:
git clone https://github.com/DEIN_USERNAME/angelverein-app.git
cd angelverein-app
git remote add upstream https://github.com/original/angelverein-app.git
```

### 2. Development Setup

```bash
# Dependencies installieren
npm install
cd client && npm install && cd ..

# Konfiguration
cp angelverein-app/.env.example angelverein-app/.env
cp angelverein-app/config.json.example angelverein-app/config.json

# Entwicklungsserver starten
npm run dev
```

Frontend läuft auf **http://localhost:5173**
Backend läuft auf **http://localhost:3500**

---

## 📝 Git Workflow

### Branch erstellen

```bash
# Für Bugs: bug/beschreibung
git checkout -b bug/login-fehler

# Für Features: feature/beschreibung
git checkout -b feature/pdf-watermark

# Für Dokumentation: docs/beschreibung
git checkout -b docs/setup-anleitung
```

### Commits

Verwende aussagekräftige Commit-Messages:

```bash
# Gut ✅
git commit -m "fix: Login Fehler bei spezialzeichen"
git commit -m "feat: PDF-Watermark hinzugefügt"
git commit -m "docs: Setup-Anleitung aktualisiert"

# Schlecht ❌
git commit -m "Fixed stuff"
git commit -m "Update"
```

### Pull Request

1. Pushe deinen Branch:
   ```bash
   git push origin feature/mein-feature
   ```

2. Erstelle einen **Pull Request** auf GitHub mit:
   - **Titel:** `feat: Kurze Beschreibung`
   - **Beschreibung:** Was ändert sich? Warum?
   - **Referenzen:** Link zu Issues falls vorhanden

3. Code Review abwarten und ggf. Änderungen vornehmen

---

## 💻 Code Style

### Frontend (React/JavaScript)

```javascript
// ✅ Gut
const handleMemberDelete = async (memberId) => {
  const confirmed = window.confirm('Mitglied wirklich löschen?');
  if (confirmed) {
    await deleteApi(`/members/${memberId}`);
  }
};

// ❌ Schlecht
const delete_member=async(id)=>{
const c=confirm('delete?');
if(c){deleteApi(`/members/${id}`);}};
```

Grundsätze:
- **camelCase** für Variablen/Funktionen
- **PascalCase** für React-Komponenten
- Aussagekräftige Namen (keine `a`, `x`, `data`)
- Kommentare für komplexe Logik
- `prettier` und `eslint` Regeln beachten

### Backend (Node.js/Express)

```javascript
// ✅ Gut
router.get('/members/:id', authenticate, async (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }
  res.json(member);
});

// Fehlerbehandlung immer!
try {
  // ...
} catch (error) {
  res.status(500).json({ error: 'Database error' });
}
```

---

## 🧪 Testing

### Manuelles Testen

- Teste lokal mit `npm run dev`
- Arbeite mit realistische Daten (große Mitgliederlisten, spezielle Zeichen)
- Teste auch Edge-Cases (Löschen, Duplikate, ungültige Eingaben)

### Browser-Kompatibilität

- Chrome/Edge (aktuell)
- Firefox (aktuell)
- Safari (aktuell)

---

## 📋 Issues & Bugs berichten

### Bug Report

Erstelle ein Issue mit:
- **Title:** `[BUG] Login funktioniert nicht mit Umlauten`
- **Beschreibung:**
  ```
  ## Beschreibung
  Wenn der Benutzername Umlaute (ä, ö, ü) enthält, funktioniert das Login nicht.
  
  ## Schritte zum Reproduzieren
  1. Benutzer mit Name "Müller" erstellen
  2. Versuchen, sich anzumelden
  3. Fehler: ...
  
  ## Erwartetes Verhalten
  Login sollte funktionieren
  
  ## Umgebung
  - OS: Windows 11
  - Browser: Chrome 125
  - App-Version: 1.0.0
  ```

### Feature Request

```
## Feature
PDF-Export mit Wassermark

## Beschreibung
Beim PDF-Export soll ein Wassermark mit dem Datum hinzugefügt werden

## Nutzen
Verhindert versehentliche Verbreitung von alten Mitgliederlisten
```

---

## ✅ Checklist für Pull Requests

Vor dem Merge:

- [ ] Code wurde lokal getestet (`npm run dev`)
- [ ] Keine Linter-Fehler (`npm run lint`)
- [ ] Kein `node_modules` oder `dist/` commitet
- [ ] `.env` Secrets sind in `.env.example` dokumentiert
- [ ] Frontend & Backend funktionieren zusammen
- [ ] Responsive Design (Mobile, Tablet, Desktop)
- [ ] Fehlerbehandlung implementiert
- [ ] Commit-Messages sind aussagekräftig

---

## 🎯 Projektstruktur

```
angelverein-app/
├── client/                # Frontend (React + Vite)
│   ├── src/components/    # React-Komponenten
│   ├── src/index.css      # Tailwind
│   └── package.json
├── server/                # Backend (Express)
│   ├── routes/            # API-Endpunkte
│   ├── middleware/        # Auth, Error-Handling
│   ├── utils/             # Helfer (PDF, Excel, etc.)
│   └── index.js           # Express-App
├── config.json            # Konfiguration (NICHT commiten!)
└── package.json           # Root-Depends
```

Neue Features sollten:
- API-Route in `server/routes/` hinzufügen
- Frontend-Komponente in `client/src/components/` hinzufügen
- Tests/Doku aktualisieren

---

## 📞 Fragen?

- Schau die [README.md](README.md) an
- Lese [DEPLOYMENT.md](DEPLOYMENT.md)
- Öffne ein [GitHub Discussion](https://github.com/deinusername/angelverein-app/discussions)

---

**Danke für deine Unterstützung! 🎣**
