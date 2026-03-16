// Zentrale Hilfsfunktionen für Datumsanzeige in der App.
// Hier definiert, damit jede Komponente dieselbe Formatierung nutzt
// und der Code nicht mehrfach dupliziert wird.

// ISO-Datum (z.B. "1976-03-15") → "15.03." (kurzes Format für Jubiläre)
export const formatDatumKurz = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const tag = String(d.getDate()).padStart(2, '0');
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  return `${tag}.${monat}.`;
};

// ISO-Datum → "10. Januar 2026" (langes Format für Termine)
export const formatDatumLang = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ISO-Datum → "Freitag" (Wochentag)
export const getWochentag = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { weekday: 'long' });
};
