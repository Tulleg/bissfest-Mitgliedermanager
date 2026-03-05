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

      // === KOPFBEREICH ===
      
      // Vereinsname
      doc.fontSize(10).fillColor('#666666')
        .text(vereinsname, { align: 'center' });
      
      doc.moveDown(0.5);

      // Überschrift
      doc.fontSize(18).fillColor('#000000')
        .text(ueberschrift, { align: 'center' });

      doc.moveDown(0.3);

      // Datum
      if (zeigeDatum) {
        const datum = new Date().toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        doc.fontSize(10).fillColor('#666666')
          .text(`Erstellt am: ${datum}`, { align: 'center' });
      }

      // Filter-Info
      if (filter && Object.keys(filter).length > 0) {
        const filterTexte = Object.entries(filter)
          .filter(([k, v]) => v)
          .map(([key, value]) => `${spaltenLabels[key] || key}: ${value}`);
        
        if (filterTexte.length > 0) {
          doc.fontSize(9).fillColor('#888888')
            .text(`Filter: ${filterTexte.join(', ')}`, { align: 'center' });
        }
      }

      // Anzahl
      if (zeigeAnzahl) {
        doc.fontSize(10).fillColor('#333333')
          .text(`Anzahl Mitglieder: ${anzahl}`, { align: 'center' });
      }

      doc.moveDown(1);

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
          { width: colWidth - 8, align: 'left' }
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
              { width: colWidth - 8, align: 'left' }
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
          let value = member[felder[i]];
          
          // Boolean-Werte formatieren
          if (value === 1 || value === true) value = 'Ja';
          if (value === 0 || value === false) value = 'Nein';
          if (value === null || value === undefined) value = '';
          
          doc.text(
            String(value),
            startX + (i * colWidth) + 4,
            currentY + 4,
            { width: colWidth - 8, align: 'left' }
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
