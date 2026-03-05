const fs = require('fs');
const pdf = require('pdf-parse');

/**
 * Parst eine PDF-Datei und versucht tabellarische Daten zu extrahieren
 */
async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  
  const text = pdfData.text;
  
  // Text in Zeilen aufteilen
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Versuche tabellarische Struktur zu erkennen
  // Strategie 1: Tab-getrennte Werte
  let data = tryParseDelimited(lines, '\t');
  if (data && data.length > 0) return data;

  // Strategie 2: Semikolon-getrennte Werte
  data = tryParseDelimited(lines, ';');
  if (data && data.length > 0) return data;

  // Strategie 3: Mehrere Leerzeichen als Trenner
  data = tryParseSpaceSeparated(lines);
  if (data && data.length > 0) return data;

  // Strategie 4: Komma-getrennte Werte
  data = tryParseDelimited(lines, ',');
  if (data && data.length > 0) return data;

  // Fallback: Jede Zeile als einzelner Eintrag
  return lines.map((line, idx) => ({
    'Zeile': idx + 1,
    'Inhalt': line
  }));
}

/**
 * Versucht Daten mit einem bestimmten Trennzeichen zu parsen
 */
function tryParseDelimited(lines, delimiter) {
  // Prüfe ob die erste Zeile das Trennzeichen enthält
  if (!lines[0].includes(delimiter)) return null;

  const headers = lines[0].split(delimiter).map(h => h.trim()).filter(h => h);
  
  if (headers.length < 2) return null;

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());
    
    if (values.length >= headers.length - 1) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      data.push(row);
    }
  }

  return data.length > 0 ? data : null;
}

/**
 * Versucht Daten zu parsen, die durch mehrere Leerzeichen getrennt sind
 */
function tryParseSpaceSeparated(lines) {
  // Suche nach Zeilen mit mindestens 2 Gruppen von Leerzeichen (3+)
  const spaceSeparatedLines = lines.filter(line => (line.match(/\s{3,}/g) || []).length >= 1);
  
  if (spaceSeparatedLines.length < 2) return null;

  // Erste passende Zeile als Header verwenden
  const headerLine = spaceSeparatedLines[0];
  const headers = headerLine.split(/\s{3,}/).map(h => h.trim()).filter(h => h);
  
  if (headers.length < 2) return null;

  const data = [];
  for (let i = 1; i < spaceSeparatedLines.length; i++) {
    const values = spaceSeparatedLines[i].split(/\s{3,}/).map(v => v.trim());
    
    if (values.length >= headers.length - 1) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      data.push(row);
    }
  }

  return data.length > 0 ? data : null;
}

module.exports = { parsePDF };
