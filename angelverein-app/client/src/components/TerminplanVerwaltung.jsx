import { useState, useEffect } from 'react';
import { formatDatumLang, getWochentag } from '../utils/datumHelpers';

// Leeres Formular
const leererTermin = {
  datum: '',
  ausweichtermin: '',
  uhrzeit: '',
  ort: '',
  beschreibung: '',
  reihenfolge: 0,
};

export default function TerminplanVerwaltung({ isEditor, isAdmin }) {
  const [jahre, setJahre] = useState([]);
  const [gewaehlteJahr, setGewaehlteJahr] = useState(null);
  const [termine, setTermine] = useState([]);
  const [status, setStatus] = useState('entwurf');
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(null);
  const [neuesJahrInput, setNeuesJahrInput] = useState('');
  const [neuesJahrZeigen, setNeuesJahrZeigen] = useState(false);

  // Formular-Zustand (null = kein Formular offen)
  const [formular, setFormular] = useState(null); // { modus: 'neu'|'bearbeiten', daten: {...}, id: null|number }
  const [speichern, setSpeichern] = useState(false);
  const [formFehler, setFormFehler] = useState(null);

  // Jahre laden
  useEffect(() => {
    fetch('/api/termine/jahre', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        // Fehler-Objekt aus Backend abfangen
        if (d.fehler) { setJahre([]); return; }
        setJahre(d);
        // Aktuelles Jahr vorauswählen
        const aktuellesJahr = new Date().getFullYear();
        const vorhanden = d.find(j => j.jahr === aktuellesJahr);
        setGewaehlteJahr(vorhanden ? aktuellesJahr : (d[0]?.jahr || aktuellesJahr));
      })
      .catch(() => setJahre([]))
      .finally(() => setLoading(false));
  }, []);

  // Termine laden wenn Jahr wechselt
  useEffect(() => {
    if (!gewaehlteJahr) return;
    setLoading(true);
    setFehler(null);
    fetch(`/api/termine/${gewaehlteJahr}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.fehler) { setFehler(d.fehler); return; }
        setTermine(d.termine || []);
        setStatus(d.status || 'entwurf');
      })
      .catch(() => setFehler('Termine konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [gewaehlteJahr]);

  // Jahr-Status ändern
  const handleStatusAendern = async (neuerStatus) => {
    if (neuerStatus === 'freigegeben' && !confirm(`Terminplan ${gewaehlteJahr} wirklich freigeben? Danach können Viewer ihn sehen.`)) return;
    if (neuerStatus === 'entwurf' && !confirm(`Freigabe zurückziehen? Der Terminplan wird wieder als Entwurf markiert.`)) return;

    try {
      const res = await fetch(`/api/termine/status/${gewaehlteJahr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: neuerStatus })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fehler || 'Fehler');
      setStatus(neuerStatus);
      // Jahren-Liste aktualisieren
      setJahre(j => j.map(jj => jj.jahr === gewaehlteJahr ? { ...jj, status: neuerStatus } : jj));
    } catch (err) {
      alert(err.message);
    }
  };

  // Neues Jahr anlegen (nur als Platzhalter, damit es in der Liste erscheint)
  const handleJahrAnlegen = () => {
    const jahr = parseInt(neuesJahrInput, 10);
    if (isNaN(jahr) || jahr < 2020 || jahr > 2100) {
      alert('Bitte ein gültiges Jahr eingeben (z.B. 2027)');
      return;
    }
    if (jahre.find(j => j.jahr === jahr)) {
      setGewaehlteJahr(jahr);
      setNeuesJahrZeigen(false);
      setNeuesJahrInput('');
      return;
    }
    setJahre(j => [...j, { jahr, status: 'entwurf', freigegeben_am: null }].sort((a, b) => b.jahr - a.jahr));
    setGewaehlteJahr(jahr);
    setNeuesJahrZeigen(false);
    setNeuesJahrInput('');
  };

  // Formular öffnen
  const handleNeuOeffnen = () => {
    setFormular({ modus: 'neu', daten: { ...leererTermin }, id: null });
    setFormFehler(null);
  };

  const handleBearbeitenOeffnen = (termin) => {
    setFormular({
      modus: 'bearbeiten',
      daten: {
        datum: termin.datum || '',
        ausweichtermin: termin.ausweichtermin || '',
        uhrzeit: termin.uhrzeit || '',
        ort: termin.ort || '',
        beschreibung: termin.beschreibung || '',
        reihenfolge: termin.reihenfolge || 0,
      },
      id: termin.id,
    });
    setFormFehler(null);
  };

  // Formular speichern
  const handleSpeichern = async (e) => {
    e.preventDefault();
    if (!formular.daten.datum) { setFormFehler('Datum ist Pflichtfeld.'); return; }
    setSpeichern(true);
    setFormFehler(null);

    try {
      let url, method;
      if (formular.modus === 'neu') {
        url = '/api/termine';
        method = 'POST';
      } else {
        url = `/api/termine/${formular.id}`;
        method = 'PUT';
      }

      const body = { ...formular.daten, jahr: gewaehlteJahr };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fehler || 'Fehler beim Speichern.');

      if (formular.modus === 'neu') {
        setTermine(t => [...t, d].sort((a, b) => a.datum.localeCompare(b.datum)));
      } else {
        setTermine(t => t.map(tt => tt.id === formular.id ? d : tt));
      }
      setFormular(null);
    } catch (err) {
      setFormFehler(err.message);
    } finally {
      setSpeichern(false);
    }
  };

  // Termin löschen
  const handleLoeschen = async (id) => {
    if (!confirm('Termin wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/termine/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.fehler); }
      setTermine(t => t.filter(tt => tt.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Termine aus dem Vorjahr übernehmen
  const handleVorjahrUebernehmen = async () => {
    const vorjahr = gewaehlteJahr - 1;
    const hinweis = termine.length > 0
      ? `Es sind bereits ${termine.length} Termin${termine.length !== 1 ? 'e' : ''} für ${gewaehlteJahr} vorhanden.\nDie Termine aus ${vorjahr} werden ZUSÄTZLICH hinzugefügt.\n\nFortfahren?`
      : `Alle Termine aus ${vorjahr} werden nach ${gewaehlteJahr} übernommen (Daten um 1 Jahr verschoben).\n\nFortfahren?`;

    if (!confirm(hinweis)) return;

    try {
      const res = await fetch(`/api/termine/kopieren/${vorjahr}/${gewaehlteJahr}`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fehler || 'Fehler beim Übernehmen.');

      setTermine(d.termine);
      // Zieljahr in der Jahresliste ergänzen, falls noch nicht vorhanden
      setJahre(j => {
        const vorhanden = j.find(jj => jj.jahr === gewaehlteJahr);
        if (vorhanden) return j;
        return [...j, { jahr: gewaehlteJahr, status: 'entwurf', freigegeben_am: null }].sort((a, b) => b.jahr - a.jahr);
      });
    } catch (err) {
      alert(err.message);
    }
  };

  // PDF herunterladen
  const handlePdfExport = () => {
    window.open(`/api/termine/export/pdf/${gewaehlteJahr}`, '_blank');
  };

  if (loading && jahre.length === 0) {
    return <div className="flex justify-center items-center py-20 text-gray-500">Lade...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">📅 Terminplan</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Jahres-Auswahl */}
          {jahre.length > 0 && (
            <select
              value={gewaehlteJahr || ''}
              onChange={e => setGewaehlteJahr(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {jahre.map(j => (
                <option key={j.jahr} value={j.jahr}>
                  {j.jahr} {j.status === 'freigegeben' ? '✓' : '(Entwurf)'}
                </option>
              ))}
            </select>
          )}

          {/* Neues Jahr */}
          {isEditor && (
            <>
              {neuesJahrZeigen ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={neuesJahrInput}
                    onChange={e => setNeuesJahrInput(e.target.value)}
                    placeholder="z.B. 2027"
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                    onKeyDown={e => e.key === 'Enter' && handleJahrAnlegen()}
                    autoFocus
                  />
                  <button onClick={handleJahrAnlegen} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">OK</button>
                  <button onClick={() => setNeuesJahrZeigen(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setNeuesJahrZeigen(true)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-300"
                >
                  + Jahr
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {fehler && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{fehler}</div>
      )}

      {gewaehlteJahr && (
        <>
          {/* Status-Zeile */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 font-medium">Terminplan {gewaehlteJahr}:</span>
              {status === 'freigegeben' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                  ✓ Freigegeben
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  ✏️ Entwurf
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* PDF-Export */}
              <button
                onClick={handlePdfExport}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-300 flex items-center gap-1"
              >
                📄 PDF exportieren
              </button>

              {/* Freigeben / Entwurf-Buttons */}
              {isEditor && status === 'entwurf' && (
                <button
                  onClick={() => handleStatusAendern('freigegeben')}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  ✓ Freigeben
                </button>
              )}
              {isAdmin && status === 'freigegeben' && (
                <button
                  onClick={() => handleStatusAendern('entwurf')}
                  className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                >
                  ↩ Zurück zu Entwurf
                </button>
              )}
            </div>
          </div>

          {/* Termin hinzufügen */}
          {isEditor && (
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">{termine.length} Termin{termine.length !== 1 ? 'e' : ''}</span>
              <div className="flex gap-2">
                {status === 'entwurf' && (
                  <button
                    onClick={handleVorjahrUebernehmen}
                    className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-300"
                    title={`Termine aus ${gewaehlteJahr - 1} übernehmen`}
                  >
                    ↩ Aus {gewaehlteJahr - 1} übernehmen
                  </button>
                )}
                <button
                  onClick={handleNeuOeffnen}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
                >
                  + Termin hinzufügen
                </button>
              </div>
            </div>
          )}

          {/* Termin-Formular */}
          {formular && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-3 text-sm">
                {formular.modus === 'neu' ? 'Neuer Termin' : 'Termin bearbeiten'}
              </h3>
              <form onSubmit={handleSpeichern} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Datum *</label>
                    <input
                      type="date"
                      value={formular.daten.datum}
                      onChange={e => setFormular(f => ({ ...f, daten: { ...f.daten, datum: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ausweichtermin (optional)</label>
                    <input
                      type="date"
                      value={formular.daten.ausweichtermin}
                      onChange={e => setFormular(f => ({ ...f, daten: { ...f.daten, ausweichtermin: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Uhrzeit</label>
                    <input
                      type="text"
                      placeholder="z.B. 10 - 12 Uhr"
                      value={formular.daten.uhrzeit}
                      onChange={e => setFormular(f => ({ ...f, daten: { ...f.daten, uhrzeit: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ort</label>
                    <input
                      type="text"
                      placeholder="z.B. Venedig Brücke"
                      value={formular.daten.ort}
                      onChange={e => setFormular(f => ({ ...f, daten: { ...f.daten, ort: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung / Veranstaltung</label>
                  <input
                    type="text"
                    placeholder="z.B. Jahreshauptversammlung"
                    value={formular.daten.beschreibung}
                    onChange={e => setFormular(f => ({ ...f, daten: { ...f.daten, beschreibung: e.target.value } }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {formFehler && (
                  <div className="text-red-600 text-sm">{formFehler}</div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={speichern}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    {speichern ? 'Speichern...' : 'Speichern'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormular(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Terminliste */}
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Lade Termine...</div>
          ) : termine.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">📅</div>
              <div className="text-sm">
                {isEditor
                  ? 'Noch keine Termine. Klicke auf "+ Termin hinzufügen".'
                  : 'Noch keine Termine für dieses Jahr.'}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Datum</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs hidden sm:table-cell">Wochentag</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Uhrzeit</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs hidden md:table-cell">Ort</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Veranstaltung</th>
                    {isEditor && <th className="px-4 py-3 w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {termine.map((termin, idx) => (
                    <tr key={termin.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                        {termin.ausweichtermin ? (
                          <>
                            <span title={`Ausweichtermin: ${formatDatumLang(termin.ausweichtermin)}`}>
                              {formatDatumLang(termin.datum)}
                            </span>
                            <div className="text-xs text-gray-400 mt-0.5">
                              Ausw.: {formatDatumLang(termin.ausweichtermin)}
                            </div>
                          </>
                        ) : (
                          formatDatumLang(termin.datum)
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{getWochentag(termin.datum)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{termin.uhrzeit || '–'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{termin.ort || '–'}</td>
                      <td className="px-4 py-3 text-gray-800">{termin.beschreibung || '–'}</td>
                      {isEditor && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => handleBearbeitenOeffnen(termin)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Bearbeiten"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleLoeschen(termin.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Löschen"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Keine Jahre vorhanden */}
      {!loading && jahre.length === 0 && !gewaehlteJahr && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">📅</div>
          <div className="text-sm">
            {isEditor
              ? 'Noch kein Terminplan angelegt. Klicke auf "+ Jahr" um zu beginnen.'
              : 'Noch kein Terminplan vorhanden.'}
          </div>
        </div>
      )}
    </div>
  );
}
