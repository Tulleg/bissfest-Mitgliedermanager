import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    fetch('/api/fische/dashboard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setFehler('Daten konnten nicht geladen werden.'); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500">
        Lade...
      </div>
    );
  }

  if (fehler) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{fehler}</div>
      </div>
    );
  }

  const { mitglieder, fischDesJahres } = data;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Mitglieder */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Mitglieder</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-blue-700">{mitglieder.jugend}</div>
            <div className="text-sm text-blue-600 mt-1 font-medium">Jugend (J)</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-green-700">{mitglieder.erwachsene}</div>
            <div className="text-sm text-green-600 mt-1 font-medium">Erwachsene (E)</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-gray-700">{mitglieder.gesamt}</div>
            <div className="text-sm text-gray-500 mt-1 font-medium">Gesamt</div>
          </div>
        </div>
      </section>

      {/* Fisch des Jahres */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Fisch des Jahres {fischDesJahres.jahr}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <div className="text-2xl mb-1">🐟</div>
            <div className="text-xl font-bold text-amber-800">
              {fischDesJahres.jugend ? fischDesJahres.jugend.name : <span className="text-gray-400 text-base font-normal">Noch nicht ausgelost</span>}
            </div>
            <div className="text-sm text-amber-600 mt-1 font-medium">Jugend</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <div className="text-2xl mb-1">🐟</div>
            <div className="text-xl font-bold text-amber-800">
              {fischDesJahres.erwachsene ? fischDesJahres.erwachsene.name : <span className="text-gray-400 text-base font-normal">Noch nicht ausgelost</span>}
            </div>
            <div className="text-sm text-amber-600 mt-1 font-medium">Erwachsene</div>
          </div>
        </div>
      </section>
    </div>
  );
}
