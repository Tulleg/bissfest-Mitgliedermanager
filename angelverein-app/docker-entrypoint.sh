#!/bin/sh
set -e

# Datenverzeichnis-Berechtigungen für appuser sicherstellen
mkdir -p /app/data /app/uploads
chown -R appuser:appgroup /app/data /app/uploads

# Als appuser starten
exec su-exec appuser node server/index.js
