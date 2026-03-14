const PDFDocument = require('pdfkit');

// Wochentag auf Deutsch aus einem ISO-Datum berechnen
function getWochentag(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { weekday: 'long' });
}

// Datum als "10. Januar" formatieren
function formatDatumLang(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const tag = d.getDate();
  const monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return `${tag}. ${monate[d.getMonth()]}`;
}

// Datum kurz als "6.Juni" formatieren (für Ausweichtermin)
function formatDatumKurz(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return `${d.getDate()}.${monate[d.getMonth()]}`;
}

/**
 * Erzeugt ein PDF-Dokument das exakt dem Terminplan-Format entspricht.
 *
 * Seite 1: Titelbox + 5-spaltige Terminliste
 * Seite 2: Regeln, Fisch des Jahres, Punkteverteilung, Vorstand, Bankdaten
 */
function generateTerminplanPDF({ jahr, termine, fischDesJahres, terminplanConfig, vereinsname }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 60, bottom: 60, left: 60, right: 60 }
      });

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const leftX = doc.page.margins.left;

      // ======================================================================
      // SEITE 1: Titelbox + Terminliste
      // ======================================================================

      // --- Titelbox (umrandetes Rechteck mit Titel) ---
      const boxHoehe = 70;
      const boxY = doc.page.margins.top;
      doc.rect(leftX, boxY, pageWidth, boxHoehe).stroke('#000000');

      // Vereinsname (fett) zentriert in Box
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000')
        .text(vereinsname, leftX, boxY + 14, { width: pageWidth, align: 'center' });

      // Untertitel "Sport – Terminplan {Jahr}" (fett)
      doc.fontSize(13).font('Helvetica-Bold')
        .text(`Sport \u2013 Terminplan ${jahr}`, leftX, boxY + 34, { width: pageWidth, align: 'center' });

      // Abstand nach der Box
      let currentY = boxY + boxHoehe + 35;

      // --- 5-spaltige Terminliste (kein Tabellenkopf, viel Whitespace) ---
      // Spaltenbreiten wie im Original: Datum | Wochentag | Uhrzeit | Ort | Beschreibung
      const col1 = 90;   // Datum
      const col2 = 75;   // Wochentag
      const col3 = 75;   // Uhrzeit
      const col4 = 130;  // Ort
      const col5 = pageWidth - col1 - col2 - col3 - col4; // Beschreibung (Rest)

      // Spaltenstartpositionen
      const x1 = leftX;
      const x2 = x1 + col1;
      const x3 = x2 + col2;
      const x4 = x3 + col3;
      const x5 = x4 + col4;

      doc.font('Helvetica').fontSize(10);

      for (const termin of termine) {
        // Neue Seite falls nötig (Schätzung: mindestens 40px pro Termin)
        if (currentY > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          currentY = doc.page.margins.top;
        }

        // Datumsanzeige: "10. Januar" oder "6.Juni/13.Juni" bei Ausweichtermin
        let datumAnzeige = formatDatumLang(termin.datum);
        if (termin.ausweichtermin) {
          datumAnzeige = `${formatDatumKurz(termin.datum)}/${formatDatumKurz(termin.ausweichtermin)}`;
        }

        // Wochentag (vom Haupttermin)
        const wochentag = getWochentag(termin.datum);

        // Beschreibung kann mehrzeilig sein – Höhe messen
        const beschreibungHoehe = doc.heightOfString(termin.beschreibung || '', { width: col5 - 5 });
        const zeilenHoehe = Math.max(beschreibungHoehe, 14);

        // Spalten nebeneinander ausgeben
        doc.fillColor('#000000');
        doc.text(datumAnzeige, x1, currentY, { width: col1, lineBreak: false });
        doc.text(wochentag, x2, currentY, { width: col2, lineBreak: false });
        doc.text(termin.uhrzeit || '', x3, currentY, { width: col3, lineBreak: false });
        doc.text(termin.ort || '', x4, currentY, { width: col4, lineBreak: false });
        doc.text(termin.beschreibung || '', x5, currentY, { width: col5 - 5 });

        // Zeilenabstand wie im Original (großzügig)
        currentY += zeilenHoehe + 22;
      }

      // ======================================================================
      // SEITE 2: Regeln, Fisch des Jahres, Punkteverteilung, Vorstand, Bankdaten
      // ======================================================================
      doc.addPage();
      currentY = doc.page.margins.top;

      // --- Obere Trennlinie ---
      doc.moveTo(leftX, currentY).lineTo(leftX + pageWidth, currentY).stroke('#000000');
      currentY += 30;

      // --- Regeln der Wertungsangeln ---
      if (terminplanConfig.regeln) {
        doc.font('Helvetica').fontSize(10).fillColor('#000000');

        const labelBreite = 170;
        const textBreite = pageWidth - labelBreite - 10;

        doc.text('Regeln der drei Wertungsangeln :', leftX, currentY, { width: labelBreite });

        // Regeln-Text rechts daneben, Abschnitte einzeln ausgeben
        const abschnitte = terminplanConfig.regeln.split('\n\n');
        let regelnY = currentY;
        for (let i = 0; i < abschnitte.length; i++) {
          const absatz = abschnitte[i].trim();
          if (!absatz) continue;
          // Erstes Wort fett (z.B. "Pokalangeln", "Nachtangeln")
          const erstesLeerzeichen = absatz.indexOf(' ');
          if (erstesLeerzeichen > 0 && i < 2) {
            const erstesWort = absatz.slice(0, erstesLeerzeichen);
            const rest = absatz.slice(erstesLeerzeichen);
            doc.font('Helvetica-Bold').text(erstesWort, leftX + labelBreite + 10, regelnY, { continued: true, width: textBreite });
            doc.font('Helvetica').text(rest, { width: textBreite });
          } else {
            doc.font('Helvetica').text(absatz, leftX + labelBreite + 10, regelnY, { width: textBreite });
          }
          regelnY = doc.y + 8;
        }

        // Fisch des Jahres (aus bestehender DB)
        if (fischDesJahres && (fischDesJahres.jugend || fischDesJahres.erwachsene)) {
          doc.font('Helvetica-Bold').text('Fisch des Jahres', leftX + labelBreite + 10, regelnY, { continued: true });
          doc.font('Helvetica').text(` ${jahr - 1} / ${jahr} :`, { continued: false });
          regelnY = doc.y + 4;

          if (fischDesJahres.erwachsene) {
            doc.font('Helvetica').text('Erwachsene', leftX + labelBreite + 10, regelnY, { continued: true, width: 90 });
            doc.text('= ', { continued: true });
            doc.font('Helvetica-Bold').text(fischDesJahres.erwachsene.name || fischDesJahres.erwachsene.fisch_name || '');
            regelnY = doc.y + 2;
          }
          if (fischDesJahres.jugend) {
            doc.font('Helvetica').text('Kinder / Jugend', leftX + labelBreite + 10, regelnY, { continued: true, width: 90 });
            doc.text('= ', { continued: true });
            doc.font('Helvetica-Bold').text(fischDesJahres.jugend.name || fischDesJahres.jugend.fisch_name || '');
            regelnY = doc.y + 2;
          }
        }
        currentY = Math.max(doc.y, regelnY) + 20;
      }

      // --- Punkteverteilung ---
      if (terminplanConfig.punkteverteilung) {
        const labelBreite = 170;
        const teile = terminplanConfig.punkteverteilung.split('|').map(t => t.trim());

        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text('Punkteverteilung bei den drei\nWertungsangeln', leftX, currentY, { width: labelBreite });

        let pvX = leftX + labelBreite + 10;
        for (const teil of teile) {
          const breite = 65;
          doc.text(teil.split('(')[0].trim(), pvX, currentY, { width: breite, lineBreak: false });
          doc.text(`(${teil.split('(')[1] || ''}`, pvX, currentY + 14, { width: breite, lineBreak: false });
          pvX += breite;
        }
        currentY = doc.y + 30;
      }

      // Meister-Info
      doc.font('Helvetica').fontSize(10).fillColor('#000000')
        .text(
          'Meister wird derjenige, der die meisten Punkte aus allen drei Angeln erzielt. Teilnahmepflicht bezüglich\nder Anzahl der Wertungsangeln nicht.',
          leftX, currentY, { width: pageWidth }
        );
      currentY = doc.y + 30;

      // --- Untere Trennlinie ---
      doc.moveTo(leftX, currentY).lineTo(leftX + pageWidth, currentY).stroke('#000000');
      currentY += 30;

      // --- Vorstandsliste ---
      const vorstand = terminplanConfig.vorstand || [];
      for (const person of vorstand) {
        const rolleBreite = 120;
        const nameBreite = 110;

        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text(person.rolle || '', leftX, currentY, { width: rolleBreite, lineBreak: false });
        doc.text(person.name || '', leftX + rolleBreite, currentY, { width: nameBreite, lineBreak: false });

        // Adresse, Telefon, E-Mail rechtsseitig
        const infoX = leftX + rolleBreite + nameBreite;
        const infoBreite = pageWidth - rolleBreite - nameBreite;
        const infos = [person.adresse, person.telefon, person.email].filter(Boolean);
        doc.text(infos.join('\n'), infoX, currentY, { width: infoBreite });

        currentY = doc.y + 20;
      }

      // --- Bankdaten ---
      if (terminplanConfig.bankdaten) {
        currentY += 10;
        const bank = terminplanConfig.bankdaten;
        const rolleBreite = 120;
        const infoX = leftX + rolleBreite;
        const infoBreite = pageWidth - rolleBreite;

        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text('Bankdaten', leftX, currentY, { width: rolleBreite, lineBreak: false });
        doc.text(
          `${bank.name}\nIBAN:   ${bank.iban}\nBIC:       ${bank.bic}`,
          infoX, currentY, { width: infoBreite }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateTerminplanPDF };
