const XLSX = require('xlsx');

/**
 * Parst eine Excel- oder CSV-Datei und gibt die Daten als Array von Objekten zurück
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    dateNF: 'dd.mm.yyyy'
  });

  // Erstes Arbeitsblatt verwenden
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // In JSON konvertieren (erste Zeile als Header)
  const data = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: ''
  });

  // Leere Zeilen entfernen
  const filteredData = data.filter(row => {
    return Object.values(row).some(val => val !== '' && val !== null && val !== undefined);
  });

  // Header bereinigen (Leerzeichen trimmen)
  const cleanedData = filteredData.map(row => {
    const cleaned = {};
    for (const [key, value] of Object.entries(row)) {
      cleaned[key.trim()] = typeof value === 'string' ? value.trim() : value;
    }
    return cleaned;
  });

  return cleanedData;
}

/**
 * Gibt die verfügbaren Arbeitsblätter einer Excel-Datei zurück
 */
function getSheetNames(filePath) {
  const workbook = XLSX.readFile(filePath);
  return workbook.SheetNames;
}

module.exports = { parseExcel, getSheetNames };
