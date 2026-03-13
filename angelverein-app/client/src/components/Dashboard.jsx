import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(null);
  const [jubilare, setJubilare] = useState(null);

  useEffect(() => {
    // Dashboard-Daten (Mitgliederzahlen + Fisch des Jahres)
    fetch('/api/fische/dashboard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setFehler('Daten konnten nicht geladen werden.'); setLoading(false); });

    // Jubilare des aktuellen Jahres
    fetch('/api/mitglieder/jubilare', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setJubilare(d))
      .catch(() => setJubilare(null));
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
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-5 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700">{mitglieder.jugend}</div>
            <div className="text-xs sm:text-sm text-blue-600 mt-1 font-medium">Jugend (J)</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-5 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-green-700">{mitglieder.erwachsene}</div>
            <div className="text-xs sm:text-sm text-green-600 mt-1 font-medium">Erwachsene (E)</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-5 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-700">{mitglieder.gesamt}</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">Gesamt</div>
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

      {/* Jubilare */}
      {jubilare && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Jubilare {jubilare.jahr}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Geburtstagsjubiläen */}
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
              <div className="text-base font-semibold text-pink-700 mb-2">🎂 Geburtstagsjubiläen</div>
              {jubilare.geburtstage.length === 0 ? (
                <div className="text-sm text-gray-400">Keine Jubiläen in diesem Jahr</div>
              ) : (
                <ul className="space-y-1">
                  {[...jubilare.geburtstage].sort((a, b) => b.jahre - a.jahre).map((j, i) => (
                    <li key={i} className="text-sm text-pink-900">
                      {j.vorname} {j.nachname} – <span className="font-semibold">{j.jahre} Jahre</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Vereinsjubiläen */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="text-base font-semibold text-indigo-700 mb-2">🏅 Vereinsjubiläen</div>
              {jubilare.mitgliedschaften.length === 0 ? (
                <div className="text-sm text-gray-400">Keine Jubiläen in diesem Jahr</div>
              ) : (
                <ul className="space-y-1">
                  {[...jubilare.mitgliedschaften].sort((a, b) => b.jahre - a.jahre).map((j, i) => (
                    <li key={i} className="text-sm text-indigo-900">
                      {j.vorname} {j.nachname} – <span className="font-semibold">{j.jahre} Jahre Mitglied</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
