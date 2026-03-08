import { useState, useEffect } from 'react'

const API_BASE = '/api'

function ExportDialog({ spalten, vereinsname }) {
  const [vorlagen, setVorlagen] = useState([])
  const [selectedVorlage, setSelectedVorlage] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newVorlage, setNewVorlage] = useState({
    name: '',
    ueberschrift: '',
    felder: [],
    filter: {},
    zeigeAnzahl: true,
    zeigeDatum: true
  })

  useEffect(() => {
    loadVorlagen()
  }, [])

  const loadVorlagen = async () => {
    try {
      const res = await fetch(`${API_BASE}/export/vorlagen`)
      const data = await res.json()
      setVorlagen(data)
    } catch (err) {
      console.error('Fehler beim Laden der Vorlagen:', err)
    }
  }

  const handleExportPDF = async (vorlageId) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vorlagenId: vorlageId })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.fehler || 'Export fehlgeschlagen')
      }

      const contentType = res.headers.get('Content-Type') || ''
      if (!contentType.includes('application/pdf')) {
        const text = await res.text()
        throw new Error('Server hat kein PDF zurückgegeben: ' + text)
      }

      // PDF herunterladen
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export_${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Fehler beim Export: ' + err.message)
    }
    setLoading(false)
  }

  const handleCustomExport = async () => {
    if (newVorlage.felder.length === 0) {
      alert('Bitte mindestens ein Feld auswählen')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customConfig: newVorlage })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.fehler || 'Export fehlgeschlagen')
      }

      const contentType2 = res.headers.get('Content-Type') || ''
      if (!contentType2.includes('application/pdf')) {
        const text = await res.text()
        throw new Error('Server hat kein PDF zurückgegeben: ' + text)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${newVorlage.name || 'export'}_${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Fehler beim Export: ' + err.message)
    }
    setLoading(false)
  }

  const handleSaveVorlage = async () => {
    if (!newVorlage.name || newVorlage.felder.length === 0) {
      alert('Bitte Name und mindestens ein Feld angeben')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/export/vorlagen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVorlage)
      })

      if (res.ok) {
        loadVorlagen()
        setShowNewForm(false)
        setNewVorlage({
          name: '',
          ueberschrift: '',
          felder: [],
          filter: {},
          zeigeAnzahl: true,
          zeigeDatum: true
        })
      }
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message)
    }
  }

  const handleDeleteVorlage = async (id) => {
    if (!confirm('Vorlage wirklich löschen?')) return
    try {
      await fetch(`${API_BASE}/export/vorlagen/${id}`, { method: 'DELETE' })
      loadVorlagen()
    } catch (err) {
      alert('Fehler beim Löschen: ' + err.message)
    }
  }

  const toggleFeld = (key) => {
    setNewVorlage(prev => ({
      ...prev,
      felder: prev.felder.includes(key)
        ? prev.felder.filter(f => f !== key)
        : [...prev.felder, key]
    }))
  }

  // Filter-Spalten (nur select-Felder)
  const filterSpalten = spalten.filter(s => s.type === 'select')

  return (
    <div className="space-y-6">
      {/* Gespeicherte Vorlagen */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">📄 PDF-Export Vorlagen</h2>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {showNewForm ? 'Abbrechen' : '+ Neue Vorlage'}
          </button>
        </div>

        {vorlagen.length === 0 && !showNewForm ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            <p>Keine Export-Vorlagen vorhanden</p>
            <p className="text-sm mt-1">Erstelle eine neue Vorlage für den PDF-Export</p>
          </div>
        ) : (
          <div className="divide-y">
            {vorlagen.map(vorlage => (
              <div key={vorlage.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <h3 className="font-medium text-gray-800">{vorlage.name}</h3>
                  <p className="text-sm text-gray-500">{vorlage.ueberschrift}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {vorlage.felder.length} Felder
                    </span>
                    {vorlage.zeigeAnzahl && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Anzahl
                      </span>
                    )}
                    {vorlage.zeigeDatum && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Datum
                      </span>
                    )}
                    {Object.keys(vorlage.filter).length > 0 && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Filter aktiv
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportPDF(vorlage.id)}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {loading ? '⏳' : '📥'} PDF erstellen
                  </button>
                  <button
                    onClick={() => handleDeleteVorlage(vorlage.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Vorlage löschen"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Neue Vorlage / Benutzerdefinierter Export */}
      {showNewForm && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">Neue Export-Vorlage</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Name und Überschrift */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vorlagenname *
                </label>
                <input
                  type="text"
                  value={newVorlage.name}
                  onChange={(e) => setNewVorlage(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="z.B. Verbandsmeldung"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Überschrift im PDF
                </label>
                <input
                  type="text"
                  value={newVorlage.ueberschrift}
                  onChange={(e) => setNewVorlage(prev => ({ ...prev, ueberschrift: e.target.value }))}
                  placeholder="z.B. Mitgliedermeldung an den Verband"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Felder auswählen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Felder im Export *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {spalten.map(spalte => (
                  <label
                    key={spalte.key}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      newVorlage.felder.includes(spalte.key)
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={newVorlage.felder.includes(spalte.key)}
                      onChange={() => toggleFeld(spalte.key)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{spalte.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter */}
            {filterSpalten.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter (optional)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterSpalten.map(spalte => (
                    <div key={spalte.key}>
                      <label className="block text-xs text-gray-500 mb-1">{spalte.label}</label>
                      <select
                        value={newVorlage.filter[spalte.key] || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setNewVorlage(prev => {
                            const filter = { ...prev.filter }
                            if (val) {
                              filter[spalte.key] = val
                            } else {
                              delete filter[spalte.key]
                            }
                            return { ...prev, filter }
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">— Alle —</option>
                        {(spalte.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optionen */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newVorlage.zeigeAnzahl}
                  onChange={(e) => setNewVorlage(prev => ({ ...prev, zeigeAnzahl: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Anzahl anzeigen</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newVorlage.zeigeDatum}
                  onChange={(e) => setNewVorlage(prev => ({ ...prev, zeigeDatum: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Datum anzeigen</span>
              </label>
            </div>

            {/* Aktionen */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <button
                onClick={handleCustomExport}
                disabled={loading || newVorlage.felder.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? '⏳ Erstelle PDF...' : '📥 PDF jetzt erstellen'}
              </button>
              <button
                onClick={handleSaveVorlage}
                disabled={!newVorlage.name || newVorlage.felder.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                💾 Vorlage speichern
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExportDialog
