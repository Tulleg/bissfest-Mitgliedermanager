import { useState } from 'react'

const API_BASE = '/api'

function ImportDialog({ spalten, onImportComplete }) {
  const [step, setStep] = useState('upload') // upload, mapping, abgleich, ergebnis
  const [uploading, setUploading] = useState(false)
  const [importData, setImportData] = useState(null)
  const [mapping, setMapping] = useState({})
  const [abgleichFeld, setAbgleichFeld] = useState('mitgliedsnummer')
  const [abgleichErgebnis, setAbgleichErgebnis] = useState(null)
  const [selectedNeu, setSelectedNeu] = useState([])
  const [selectedUpdates, setSelectedUpdates] = useState([])
  const [processing, setProcessing] = useState(false)

  // Datei hochladen
  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('datei', file)

    try {
      const res = await fetch(`${API_BASE}/import/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.fehler || 'Upload fehlgeschlagen')
      }

      const data = await res.json()
      setImportData(data)
      setMapping(data.vorgeschlagenesMapping || {})
      setStep('mapping')
    } catch (err) {
      alert('Fehler beim Upload: ' + err.message)
    }
    setUploading(false)
  }

  // Abgleich starten
  const handleAbgleich = async () => {
    if (!importData) return

    setProcessing(true)
    try {
      const res = await fetch(`${API_BASE}/import/abgleich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daten: importData.importierteDaten,
          mapping,
          abgleichFeld
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.fehler || 'Abgleich fehlgeschlagen')
      }

      const ergebnis = await res.json()
      setAbgleichErgebnis(ergebnis)
      // Standardmäßig alle neuen und Updates auswählen
      setSelectedNeu(ergebnis.neu.map((_, i) => i))
      setSelectedUpdates(ergebnis.unterschiede.map((_, i) => i))
      setStep('abgleich')
    } catch (err) {
      alert('Fehler beim Abgleich: ' + err.message)
    }
    setProcessing(false)
  }

  // Änderungen übernehmen
  const handleUebernehmen = async () => {
    if (!abgleichErgebnis) return

    setProcessing(true)
    try {
      const neueEintraege = selectedNeu.map(i => abgleichErgebnis.neu[i])
      const aktualisierungen = selectedUpdates.map(i => ({
        id: abgleichErgebnis.unterschiede[i].id,
        daten: abgleichErgebnis.unterschiede[i].importierteDaten
      }))

      const res = await fetch(`${API_BASE}/import/uebernehmen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neueEintraege, aktualisierungen })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.fehler || 'Übernahme fehlgeschlagen')
      }

      const result = await res.json()
      setStep('ergebnis')
      onImportComplete()
    } catch (err) {
      alert('Fehler beim Übernehmen: ' + err.message)
    }
    setProcessing(false)
  }

  const resetImport = () => {
    setStep('upload')
    setImportData(null)
    setMapping({})
    setAbgleichErgebnis(null)
    setSelectedNeu([])
    setSelectedUpdates([])
  }

  return (
    <div className="space-y-6">
      {/* Fortschrittsanzeige */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex items-center gap-4">
          {['upload', 'mapping', 'abgleich', 'ergebnis'].map((s, i) => {
            const labels = ['1. Datei hochladen', '2. Spalten zuordnen', '3. Abgleich prüfen', '4. Ergebnis']
            const isActive = s === step
            const isDone = ['upload', 'mapping', 'abgleich', 'ergebnis'].indexOf(step) > i
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive ? 'bg-blue-600 text-white' :
                  isDone ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${isActive ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                  {labels[i]}
                </span>
                {i < 3 && <span className="text-gray-300 mx-2">→</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Schritt 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">📥 Datei hochladen</h2>
            <p className="text-sm text-gray-500 mt-1">
              Lade eine Excel- (.xlsx/.xls) oder PDF-Datei hoch, um sie mit der Mitgliederliste abzugleichen.
            </p>
          </div>
          <div className="p-6">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="text-center">
                {uploading ? (
                  <>
                    <div className="text-4xl mb-2">⏳</div>
                    <p className="text-gray-500">Datei wird verarbeitet...</p>
                  </>
                ) : (
                  <>
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-gray-600 font-medium">Datei auswählen oder hierher ziehen</p>
                    <p className="text-gray-400 text-sm mt-1">Excel (.xlsx, .xls, .csv) oder PDF</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Schritt 2: Mapping */}
      {step === 'mapping' && importData && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">🔗 Spalten zuordnen</h2>
            <p className="text-sm text-gray-500 mt-1">
              {importData.anzahlZeilen} Zeilen gefunden. Ordne die importierten Spalten den Mitglieder-Feldern zu.
            </p>
          </div>
          <div className="p-6 space-y-4">
            {/* Abgleichfeld */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-yellow-800 mb-2">
                🔑 Abgleichfeld (zum Erkennen bestehender Mitglieder)
              </label>
              <select
                value={abgleichFeld}
                onChange={(e) => setAbgleichFeld(e.target.value)}
                className="px-3 py-2 border border-yellow-300 rounded-lg text-sm bg-white"
              >
                {spalten.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Spalten-Mapping */}
            <div className="space-y-2">
              {importData.importierteHeader.map(header => (
                <div key={header} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-1/3">
                    <span className="text-sm font-medium text-gray-700">
                      📊 {header}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      (z.B. "{importData.importierteDaten[0]?.[header] || ''}")
                    </span>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="w-1/3">
                    <select
                      value={mapping[header] || ''}
                      onChange={(e) => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">— Nicht zuordnen —</option>
                      {spalten.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Vorschau */}
            {importData.importierteDaten.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Vorschau (erste 3 Zeilen)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border">
                    <thead>
                      <tr className="bg-gray-100">
                        {importData.importierteHeader.map(h => (
                          <th key={h} className="px-2 py-1 border text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importData.importierteDaten.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {importData.importierteHeader.map(h => (
                            <td key={h} className="px-2 py-1 border">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t">
              <button
                onClick={handleAbgleich}
                disabled={processing || Object.values(mapping).filter(v => v).length === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {processing ? '⏳ Abgleich läuft...' : '🔍 Abgleich starten'}
              </button>
              <button
                onClick={resetImport}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Zurück
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schritt 3: Abgleich-Ergebnis */}
      {step === 'abgleich' && abgleichErgebnis && (
        <div className="space-y-4">
          {/* Zusammenfassung */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{abgleichErgebnis.uebereinstimmungen.length}</div>
              <div className="text-sm text-green-600">Übereinstimmungen</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-700">{abgleichErgebnis.unterschiede.length}</div>
              <div className="text-sm text-yellow-600">Unterschiede</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{abgleichErgebnis.neu.length}</div>
              <div className="text-sm text-blue-600">Neue Einträge</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-700">{abgleichErgebnis.nichtInImport.length}</div>
              <div className="text-sm text-gray-600">Nicht im Import</div>
            </div>
          </div>

          {/* Unterschiede */}
          {abgleichErgebnis.unterschiede.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold text-yellow-700">⚠️ Unterschiede ({abgleichErgebnis.unterschiede.length})</h3>
                <p className="text-sm text-gray-500">Diese Mitglieder existieren, haben aber abweichende Daten</p>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {abgleichErgebnis.unterschiede.map((diff, idx) => (
                  <div key={idx} className="px-6 py-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedUpdates.includes(idx)}
                        onChange={() => {
                          setSelectedUpdates(prev =>
                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                          )
                        }}
                        className="mt-1 w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">
                          ID: {diff.id}
                        </div>
                        <div className="mt-1 space-y-1">
                          {Object.entries(diff.unterschiede).map(([key, val]) => {
                            const spalte = spalten.find(s => s.key === key)
                            return (
                              <div key={key} className="text-xs flex items-center gap-2">
                                <span className="text-gray-500 w-24">{spalte?.label || key}:</span>
                                <span className="text-red-500 line-through">{val.alt || '(leer)'}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-600 font-medium">{val.neu}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Neue Einträge */}
          {abgleichErgebnis.neu.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold text-blue-700">🆕 Neue Einträge ({abgleichErgebnis.neu.length})</h3>
                <p className="text-sm text-gray-500">Diese Einträge sind nicht in der Mitgliederliste</p>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {abgleichErgebnis.neu.map((entry, idx) => (
                  <div key={idx} className="px-6 py-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedNeu.includes(idx)}
                        onChange={() => {
                          setSelectedNeu(prev =>
                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                          )
                        }}
                        className="mt-1 w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1 text-sm">
                        {Object.entries(entry).map(([key, val]) => {
                          const spalte = spalten.find(s => s.key === key)
                          return (
                            <span key={key} className="inline-block mr-4">
                              <span className="text-gray-500">{spalte?.label || key}: </span>
                              <span className="font-medium">{val}</span>
                            </span>
                          )
                        })}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aktionen */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleUebernehmen}
              disabled={processing || (selectedNeu.length === 0 && selectedUpdates.length === 0)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
            >
              {processing ? '⏳ Wird übernommen...' : `✅ Ausgewählte übernehmen (${selectedNeu.length + selectedUpdates.length})`}
            </button>
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Zurück zum Mapping
            </button>
            <button
              onClick={resetImport}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Schritt 4: Ergebnis */}
      {step === 'ergebnis' && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Import abgeschlossen!</h2>
          <p className="text-gray-500 mb-6">
            Die ausgewählten Änderungen wurden erfolgreich übernommen.
          </p>
          <button
            onClick={resetImport}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Neuen Import starten
          </button>
        </div>
      )}
    </div>
  )
}

export default ImportDialog
