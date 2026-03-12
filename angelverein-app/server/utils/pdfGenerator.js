const PDFDocument = require('pdfkit');

/**
 * Generiert ein PDF-Dokument mit Mitgliederdaten
 */
function generatePDF(options) {
  const {
    vereinsname,
    ueberschrift,
    felder,
    spaltenLabels,
    mitglieder,
    anzahl,
    zeigeAnzahl,
    zeigeDatum,
    filter
  } = options;

  if (!felder || !Array.isArray(felder) || felder.length === 0) {
    throw new Error('Felder-Liste darf nicht leer sein');
  }

  // normalisiere Feldnamen (schon vorhandene keys können punkt oder großbuchstaben enthalten)
  const normalize = key => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedMap = {};
  felder.forEach(k => { normalizedMap[normalize(k)] = k; });

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: felder.length > 5 ? 'landscape' : 'portrait',
        margins: { top: 40, bottom: 40, left: 40, right: 40 }
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // === COVERSEITE ===
      // Vereinsname groß
      doc.fontSize(24).fillColor('#000000').text(vereinsname, { align: 'center' });
      doc.moveDown(1.5);

      // Titel / Überschrift
      doc.fontSize(20).fillColor('#000000').text(ueberschrift, { align: 'center' });
      doc.moveDown(0.7);

      // Datum + Anzahl
      if (zeigeDatum || zeigeAnzahl) {
        const parts = [];
        if (zeigeDatum) {
          const datum = new Date().toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          parts.push(`Stand: ${datum}`);
        }
        if (zeigeAnzahl) {
          parts.push(`Mitglieder: ${anzahl}`);
        }
        doc.fontSize(12).fillColor('#333333').text(parts.join(' | '), { align: 'center' });
        doc.moveDown(0.7);
      }

      // Filter-Info auf Cover
      if (filter && Object.keys(filter).length > 0) {
        const filterTexte = Object.entries(filter)
          .filter(([k, v]) => v)
          .map(([key, config]) => {
            // Neues Format { op, wert } und altes Format (reiner String) unterstützen
            const op = typeof config === 'string' ? 'enthält' : (config.op || 'enthält');
            const wert = typeof config === 'string' ? config : config.wert;
            // | durch " oder " ersetzen für bessere Lesbarkeit
            const wertLeserlich = wert.split('|').map(t => t.trim()).join(' oder ');
            return `${spaltenLabels[key] || key} ${op} "${wertLeserlich}"`;
          });
        if (filterTexte.length > 0) {
          doc.fontSize(10).fillColor('#888888')
            .text(`Filter: ${filterTexte.join(', ')}`, { align: 'center' });
          doc.moveDown(0.5);
        }
      }

      // Neue Seite für Tabelle
      doc.addPage();
      // === TABELLE ===
      
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colCount = felder.length;
      const colWidth = pageWidth / colCount;
      const startX = doc.page.margins.left;
      let currentY = doc.y;

      // Tabellenkopf
      doc.fontSize(9).fillColor('#ffffff');
      
      // Hintergrund für Header
      doc.rect(startX, currentY, pageWidth, 20).fill('#2563eb');
      
      doc.fillColor('#ffffff');
      for (let i = 0; i < felder.length; i++) {
        const label = spaltenLabels[felder[i]] || felder[i];
        doc.text(
          label,
          startX + (i * colWidth) + 4,
          currentY + 5,
          { width: colWidth - 8, align: 'left', lineBreak: false }
        );
      }

      currentY += 22;

      // Tabellenzeilen
      doc.fillColor('#000000');
      
      for (let rowIdx = 0; rowIdx < mitglieder.length; rowIdx++) {
        const member = mitglieder[rowIdx];
        
        // Neue Seite wenn nötig
        if (currentY > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          currentY = doc.page.margins.top;
          
          // Header auf neuer Seite wiederholen
          doc.rect(startX, currentY, pageWidth, 20).fill('#2563eb');
          doc.fillColor('#ffffff').fontSize(9);
          for (let i = 0; i < felder.length; i++) {
            const label = spaltenLabels[felder[i]] || felder[i];
            doc.text(
              label,
              startX + (i * colWidth) + 4,
              currentY + 5,
              { width: colWidth - 8, align: 'left', lineBreak: false }
            );
          }
          currentY += 22;
          doc.fillColor('#000000');
        }

        // Abwechselnde Zeilenfarbe
        if (rowIdx % 2 === 0) {
          doc.rect(startX, currentY, pageWidth, 18).fill('#f3f4f6');
          doc.fillColor('#000000');
        }

        // Zelleninhalte
        doc.fontSize(8);
        for (let i = 0; i < felder.length; i++) {
          // try to find value by field name, normalizing both sides
          let value = member[felder[i]];
          if (value === undefined) {
            const norm = normalize(felder[i]);
            for (const mk of Object.keys(member)) {
              if (normalize(mk) === norm) {
                value = member[mk];
                break;
              }
            }
          }
          // Boolean-Werte formatieren
          if (value === 1 || value === true) value = 'Ja';
          if (value === 0 || value === false) value = 'Nein';
          if (value === null || value === undefined) value = '';
          
          doc.text(
            String(value),
            startX + (i * colWidth) + 4,
            currentY + 4,
            { width: colWidth - 8, align: 'left', lineBreak: false }
          );
        }

        currentY += 18;
      }

      // Untere Linie
      doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY).stroke('#cccccc');

      // === FUSSBEREICH ===
      currentY += 15;
      
      if (zeigeAnzahl) {
        doc.fontSize(9).fillColor('#333333')
          .text(`Gesamt: ${anzahl} Mitglieder`, startX, currentY);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePDF };
