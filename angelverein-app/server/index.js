const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const crypto = require('crypto');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
const { initializeDatabase } = require('./database');
const { initializeAuthDatabase } = require('./auth-db');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = config.port || 3500;

// Session-Secret: aus Umgebungsvariable oder zufällig generiert (persistent in Datei)
function getSessionSecret() {
  const secretPath = path.join(__dirname, '..', 'data', '.session-secret');
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf-8').trim();
  }
  const secret = crypto.randomBytes(48).toString('hex');
  const dataDir = path.dirname(secretPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(secretPath, secret);
  return secret;
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session-Middleware
app.use(session({
  name: 'angelverein.sid',
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, '..', 'data')
  }),
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY === 'true',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Tage
  }
}));

// Trust proxy wenn hinter Reverse Proxy (Cloudflare Tunnel)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Statische Dateien (Frontend Build)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// Auth-Routen (NICHT geschützt - Login/Setup muss ohne Auth erreichbar sein)
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

// Config-Endpunkt (NICHT geschützt - Frontend braucht Config für Login-Seite)
app.get('/api/config', (req, res) => {
  res.json({
    vereinsname: config.vereinsname,
    spalten: config.spalten
  });
});

// === Ab hier: Alle API-Routen geschützt ===
app.use('/api', requireAuth);

// API-Routen (geschützt)
const membersRouter = require('./routes/members');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');

app.use('/api/mitglieder', membersRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

// Block access to /data/* paths
app.get('/data/*', (req, res) => {
  res.status(404).send('Not found');
});

// SPA Fallback - alle nicht-API Routen zum Frontend weiterleiten
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send(`
        <html>
          <head><title>Angelverein Verwaltung</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🎣 ${config.vereinsname}</h1>
            <p>Backend läuft auf Port ${PORT}</p>
            <p>Frontend noch nicht gebaut. Bitte <code>npm run build</code> ausführen.</p>
            <hr>
            <p>API verfügbar unter:</p>
            <ul style="list-style: none;">
              <li><a href="/api/config">/api/config</a> - Konfiguration</li>
              <li><a href="/api/auth/setup">/api/auth/setup</a> - Setup-Status</li>
            </ul>
          </body>
        </html>
      `);
    }
  }
});

// Datenbanken initialisieren und Server starten
initializeAuthDatabase();
initializeDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎣 ${config.vereinsname} - Mitgliederverwaltung`);
  console.log(`📡 Server läuft auf http://localhost:${PORT}`);
  console.log(`🔒 Authentifizierung aktiv`);
  console.log(`📋 API: http://localhost:${PORT}/api/config\n`);
});
