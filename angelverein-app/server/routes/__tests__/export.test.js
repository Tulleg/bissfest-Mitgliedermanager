const request = require('supertest');
const express = require('express');
const exportRouter = require('../export');
const db = require('../../database');
// helper functions for PDF inspection
const zlib = require('zlib');
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
      // ignore
    }
  }
  return { raw: text, decompressed: all };
}

// override requireRole middleware to skip auth
jest.mock('../../middleware/roleCheck', () => ({
  requireRole: () => (req, res, next) => next()
}));

describe('export route', () => {
  let app;
  let testTemplateId;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/export', exportRouter);

    // ensure there is at least one member and one template
    db.deleteAllMembers && db.deleteAllMembers();
    db.deleteAllExportVorlagen && db.deleteAllExportVorlagen();

    const id = db.createExportVorlage({
      name: 'T',
      ueberschrift: 'U',
      felder: ['vorname', 'nachname'],
      filter: {},
      zeigeAnzahl: true,
      zeigeDatum: false
    });
    expect(id).toBeDefined();
    // store id for later
    testTemplateId = id;
  });

  it('returns pdf buffer for stored template', async () => {
    const res = await request(app)
      .post('/api/export/pdf')
      .send({ vorlagenId: testTemplateId })
      .expect(200)
      .expect('Content-Type', /application\/pdf/);

    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.toString('utf8',0,4)).toBe('%PDF');
    const { raw, decompressed } = extractTextFromPDF(res.body);
    const pages = (raw.match(/\/Type \/Page/g) || []).length;
    expect(pages).toBeGreaterThanOrEqual(2);
    const combined = raw + '\n' + decompressed;
    expect(combined).toMatch(/Mitgliederliste|U/);
  });

  it('rejects empty field config', async () => {
    const res = await request(app)
      .post('/api/export/pdf')
      .send({ customConfig: { felder: [] } });
    expect(res.status).toBe(400);
  });
});
