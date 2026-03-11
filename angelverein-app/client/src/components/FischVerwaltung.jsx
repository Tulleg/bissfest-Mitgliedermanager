import { useEffect, useState } from 'react';

const KATEGORIEN = [
  { key: 'J', label: 'Jugend' },
  { key: 'E', label: 'Erwachsene' }
];

function FischTabelle({ kategorie, fische, aktuellesJahr, onAktualisieren }) {
  const [neuerName, setNeuerName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editDaten, setEditDaten] = useState({});
  const [jahresauswahlFischId, setJahresauswahlFischId] = useState('');
  const [jahresauswahlJahr, setJahresauswahlJahr] = useState(aktuellesJahr);
  const [fehler, setFehler] = useState(null);
  const [erfolg, setErfolg] = useState(null);

  const zeigeNachricht = (msg, istFehler = false) => {
    if (istFehler) { setFehler(msg); setErfolg(null); }
    else { setErfolg(msg); setFehler(null); }
    setTimeout(() => { setFehler(null); setErfolg(null); }, 3000);
  };

  const fischHinzufuegen = async () => {
    if (!neuerName.trim()) return;
    const r = await fetch('/api/fische', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: neuerName.trim(), kategorie })
    });
    if (r.ok) { setNeuerName(''); onAktualisieren(); zeigeNachricht('Fisch hinzugefügt'); }
    else { const d = await r.json(); zeigeNachricht(d.fehler || 'Fehler', true); }
  };

  const fischLoeschen = async (id) => {
    if (!confirm('Fisch wirklich löschen?')) return;
    const r = await fetch(`/api/fische/${id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { onAktualisieren(); zeigeNachricht('Fisch gelöscht'); }
    else { const d = await r.json(); zeigeNachricht(d.fehler || 'Fehler', true); }
  };

  const editStarten = (fisch) => {
    setEditId(fisch.id);
    setEditDaten({ name: fisch.name, gesperrt_bis_jahr: fisch.gesperrt_bis_jahr ?? '' });
  };

  const editSpeichern = async () => {
    const payload = {
      name: editDaten.name,
      gesperrt_bis_jahr: editDaten.gesperrt_bis_jahr === '' ? null : Number(editDaten.gesperrt_bis_jahr)
    };
    const r = await fetch(`/api/fische/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (r.ok) { setEditId(null); onAktualisieren(); zeigeNachricht('Gespeichert'); }
    else { const d = await r.json(); zeigeNachricht(d.fehler || 'Fehler', true); }
  };

  const fischDesJahresSetzen = async () => {
    if (!jahresauswahlFischId) return;
    const r = await fetch('/api/fische/jahresauswahl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ jahr: Number(jahresauswahlJahr), kategorie, fisch_id: Number(jahresauswahlFischId) })
    });
    if (r.ok) {
      setJahresauswahlFischId('');
      onAktualisieren();
      zeigeNachricht(`Fisch des Jahres ${jahresauswahlJahr} gesetzt. Sperre bis ${Number(jahresauswahlJahr) + 3} automatisch eingetragen.`);
    } else {
      const d = await r.json(); zeigeNachricht(d.fehler || 'Fehler', true);
    }
  };

  const aktuellesJahrInt = new Date().getFullYear();
  const nichtGesperrte = fische.filter(f =>
    f.gesperrt_bis_jahr == null || f.gesperrt_bis_jahr < aktuellesJahrInt
  );

  return (
    <div className="space-y-6">
      {fehler && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{fehler}</div>}
      {erfolg && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{erfolg}</div>}

      {/* Fischliste */}
      <div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Fischname</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Gesperrt bis</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fische.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">Noch keine Fische eingetragen</td></tr>
            )}
            {fische.map(fisch => {
              const gesperrt = fisch.gesperrt_bis_jahr != null && fisch.gesperrt_bis_jahr >= aktuellesJahrInt;
              if (editId === fisch.id) {
                return (
                  <tr key={fisch.id} className="border-b bg-blue-50">
                    <td className="px-3 py-2">
                      <input
                        className="border rounded px-2 py-1 w-full text-sm"
                        value={editDaten.name}
                        onChange={e => setEditDaten(d => ({ ...d, name: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-28 text-sm"
                        placeholder="kein"
                        value={editDaten.gesperrt_bis_jahr}
                        onChange={e => setEditDaten(d => ({ ...d, gesperrt_bis_jahr: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-2 flex gap-2">
                      <button onClick={editSpeichern} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Speichern</button>
                      <button onClick={() => setEditId(null)} className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">Abbrechen</button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={fisch.id} className={`border-b ${gesperrt ? 'bg-red-50 text-gray-400' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2">
                    {fisch.name}
                    {gesperrt && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">gesperrt</span>}
                  </td>
                  <td className="px-3 py-2">
                    {fisch.gesperrt_bis_jahr ? `bis ${fisch.gesperrt_bis_jahr}` : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => editStarten(fisch)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Bearbeiten</button>
                      <button onClick={() => fischLoeschen(fisch.id)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Löschen</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fisch hinzufügen */}
      <div className="flex gap-2 items-center">
        <input
          className="border rounded px-3 py-2 text-sm flex-1"
          placeholder="Neuer Fisch..."
          value={neuerName}
          onChange={e => setNeuerName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fischHinzufuegen()}
        />
        <button
          onClick={fischHinzufuegen}
          disabled={!neuerName.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-40"
        >
          Hinzufügen
        </button>
      </div>

      {/* Fisch des Jahres setzen */}
      <div className="border-t pt-5">
        <h4 className="font-medium text-gray-700 mb-3">Fisch des Jahres setzen</h4>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="number"
            className="border rounded px-3 py-2 text-sm w-28"
            value={jahresauswahlJahr}
            onChange={e => setJahresauswahlJahr(Number(e.target.value))}
          />
          <select
            className="border rounded px-3 py-2 text-sm flex-1 min-w-40"
            value={jahresauswahlFischId}
            onChange={e => setJahresauswahlFischId(e.target.value)}
          >
            <option value="">Fisch auswählen...</option>
            {nichtGesperrte.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={fischDesJahresSetzen}
            disabled={!jahresauswahlFischId}
            className="px-3 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-40"
          >
            Festlegen
          </button>
        </div>
        {nichtGesperrte.length === 0 && (
          <p className="text-sm text-gray-400 mt-2">Alle Fische sind gesperrt. Bitte zuerst Fische hinzufügen oder Sperren bearbeiten.</p>
        )}
      </div>
    </div>
  );
}

export default function FischVerwaltung() {
  const [aktiveKategorie, setAktiveKategorie] = useState('J');
  const [fische, setFische] = useState([]);
  const [loading, setLoading] = useState(true);

  const ladeFische = () => {
    setLoading(true);
    fetch('/api/fische', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setFische(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { ladeFische(); }, []);

  const aktuellesJahr = new Date().getFullYear();
  const gefiltert = fische.filter(f => f.kategorie === aktiveKategorie);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Fischverwaltung</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {KATEGORIEN.map(k => (
          <button
            key={k.key}
            onClick={() => setAktiveKategorie(k.key)}
            className={`px-5 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              aktiveKategorie === k.key
                ? 'bg-white border border-b-white -mb-px text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Lade...</div>
      ) : (
        <FischTabelle
          key={aktiveKategorie}
          kategorie={aktiveKategorie}
          fische={gefiltert}
          aktuellesJahr={aktuellesJahr}
          onAktualisieren={ladeFische}
        />
      )}
    </div>
  );
}
