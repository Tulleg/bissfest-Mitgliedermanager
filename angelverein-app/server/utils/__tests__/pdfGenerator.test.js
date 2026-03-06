const { generatePDF } = require('../pdfGenerator');

const zlib = require('zlib');

// helper to decompress PDF streams and collect text
function extractTextFromPDF(buffer) {
  const text = buffer.toString('latin1');
  let all = '';
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    try {
      const comp = Buffer.from(match[1], 'latin1');
      const dec = zlib.inflateSync(comp);
      all += dec.toString('latin1');
    } catch (err) {
      // ignore decompression errors
    }
  }
  return { raw: text, decompressed: all };
}

describe('pdfGenerator', () => {
  it('produces a Buffer containing a PDF with cover and table', async () => {
    const options = {
      vereinsname: 'Testverein',
      ueberschrift: 'Mitgliederliste',
      felder: ['vorname', 'nachname'],
      spaltenLabels: { vorname: 'Vorname', nachname: 'Nachname' },
      mitglieder: [
        { vorname: 'Max', nachname: 'Mustermann' },
        { vorname: 'Erika', nachname: 'Musterfrau' }
      ],
      anzahl: 2,
      zeigeAnzahl: true,
      zeigeDatum: true,
      filter: { vorname: 'Max' }
    };

    const buf = await generatePDF(options);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);

    expect(buf.toString('utf8', 0, 4)).toBe('%PDF');
    const { raw, decompressed } = extractTextFromPDF(buf);
    // rough page count by tokens
    const pages = (raw.match(/\/Type \/Page/g) || []).length;
    expect(pages).toBeGreaterThanOrEqual(2);
    // verify some strings appear in either raw or decompressed text
    let combined = raw + '\n' + decompressed;
    // decode hex blocks like <54> into characters
    combined = combined.replace(/<([0-9A-Fa-f]+)>/g, (_, hex) => {
      let out = '';
      for (let i = 0; i < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return out;
    });
    // remove numeric spacing commands left in TJ arrays
    combined = combined.replace(/\b\d+\b/g, '');
    combined = combined.replace(/\s+/g, ' ');
    // allow spaces or dashes between segments
    expect(combined).toMatch(/T\s*estv\s*erein/);
    expect(combined).toMatch(/Mitglieder/);
    expect(combined).toMatch(/Max/);
  });

  it('throws if felder array is empty', async () => {
    // generator throws synchronously before returning Promise
    expect(() => generatePDF({ felder: [] })).toThrow(/Felder/);
  });

  it('handles empty member list (still generates cover)', async () => {
    const buf = await generatePDF({
      vereinsname: 'V',
      ueberschrift: 'U',
      felder: ['a'],
      spaltenLabels: { a: 'A' },
      mitglieder: [],
      anzahl: 0,
      zeigeAnzahl: false,
      zeigeDatum: false,
      filter: {}
    });
    expect(buf.toString('utf8', 0, 4)).toBe('%PDF');
    const { raw } = extractTextFromPDF(buf);
    const pages = (raw.match(/\/Type \/Page/g) || []).length;
    expect(pages).toBeGreaterThanOrEqual(1);
  });

  it('normalizes field keys to match member properties', async () => {
    const options = {
      vereinsname: 'V',
      ueberschrift: 'U',
      felder: ['nr'],            // note: actual member key is 'nr.'
      spaltenLabels: { 'nr.': 'Nr.' },
      mitglieder: [ { 'nr.': '007' } ],
      anzahl: 1,
      zeigeAnzahl: false,
      zeigeDatum: false,
      filter: {}
    };
    const buf = await generatePDF(options);
    const { raw, decompressed } = extractTextFromPDF(buf);
    let combined = raw + '\n' + decompressed;
    combined = combined.replace(/<([0-9A-Fa-f]+)>/g, (_, hex) => {
      let out = '';
      for (let i = 0; i < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return out;
    });
    // do NOT remove digits here; we want to see the actual member value
    combined = combined.replace(/\s+/g, ' ');
    expect(combined).toMatch(/007/);
  });
});
