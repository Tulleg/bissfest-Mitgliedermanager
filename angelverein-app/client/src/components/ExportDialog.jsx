import { useState, useEffect } from 'react'
import { blobAlsDateiSpeichern } from '../utils/downloadHelper'

const API_BASE = '/api'

function ExportDialog({ spalten, vereinsname }) {
  const [vorlagen, setVorlagen] = useState([])
  const [selectedVorlage, setSelectedVorlage] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [editiereVorlageId, setEditiereVorlageId] = useState(null) // null = neue Vorlage, Zahl = Bearbeiten
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

  // Gemeinsame Funktion für beide Export-Wege.
  // body: entweder { vorlagenId } oder { customConfig } – je nach Export-Art
  // dateiname: der vorgeschlagene Dateiname für den Download
  const exportierePDF = async (body, dateiname) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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

      const blob = await res.blob()
      blobAlsDateiSpeichern(blob, dateiname)
    } catch (err) {
      alert('Fehler beim Export: ' + err.message)
    }
    setLoading(false)
  }

  // Export einer gespeicherten Vorlage
  const handleExportPDF = (vorlageId) => {
    exportierePDF({ vorlagenId: vorlageId }, `export_${Date.now()}.pdf`)
  }

  // Export mit benutzerdefinierter Konfiguration
  const handleCustomExport = () => {
    if (newVorlage.felder.length === 0) {
      alert('Bitte mindestens ein Feld auswählen')
      return
    }
    exportierePDF({ customConfig: newVorlage }, `${newVorlage.name || 'export'}_${Date.now()}.pdf`)
  }

  const handleSaveVorlage = async () => {
    if (!newVorlage.name || newVorlage.felder.length === 0) {
      alert('Bitte Name und mindestens ein Feld angeben')
      return
    }

    try {
      // Bearbeiten-Modus: PUT, sonst neu erstellen: POST
      const url = editiereVorlageId
        ? `${API_BASE}/export/vorlagen/${editiereVorlageId}`
        : `${API_BASE}/export/vorlagen`
      const method = editiereVorlageId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVorlage)
      })

      if (res.ok) {
        loadVorlagen()
        handleAbbrechen()
      }
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message)
    }
  }

  // Vorlage zum Bearbeiten öffnen – Formular mit bestehenden Daten vorbelegen
  const handleEditVorlage = (vorlage) => {
    setNewVorlage({
      name: vorlage.name,
      ueberschrift: vorlage.ueberschrift || '',
      felder: vorlage.felder,
      filter: vorlage.filter || {},
      zeigeAnzahl: vorlage.zeigeAnzahl,
      zeigeDatum: vorlage.zeigeDatum
    })
    setEditiereVorlageId(vorlage.id)
    setShowNewForm(true)
  }

  // Formular komplett zurücksetzen (Abbrechen oder nach Speichern)
  const handleAbbrechen = () => {
    setShowNewForm(false)
    setEditiereVorlageId(null)
    setNewVorlage({
      name: '',
      ueberschrift: '',
      felder: [],
      filter: {},
      zeigeAnzahl: true,
      zeigeDatum: true
    })
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


  return (
    <div className="space-y-6">
      {/* Gespeicherte Vorlagen */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">📄 PDF-Export Vorlagen</h2>
          <button
            onClick={() => showNewForm ? handleAbbrechen() : setShowNewForm(true)}
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
                    onClick={() => handleEditVorlage(vorlage)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Vorlage bearbeiten"
                  >
                    ✏️
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
            <h2 className="text-lg font-semibold text-gray-800">
              {editiereVorlageId ? 'Vorlage bearbeiten' : 'Neue Export-Vorlage'}
            </h2>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter (optional)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Mehrere Felder werden mit UND verknüpft. Mit <code className="bg-gray-100 px-1 rounded">|</code> mehrere Werte trennen für ODER (z.B. <code className="bg-gray-100 px-1 rounded">J|E</code>).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {spalten.map(spalte => {
                  // Aktuellen Filter-Wert holen (neues Format oder leer)
                  const filterKonfig = newVorlage.filter[spalte.key] || { op: 'enthält', wert: '' }
                  return (
                    <div key={spalte.key}>
                      <label className="block text-xs text-gray-500 mb-1">{spalte.label}</label>
                      <div className="flex gap-1">
                        {/* Operator-Auswahl: "enthält" oder "ist gleich" */}
                        <select
                          value={filterKonfig.op}
                          onChange={(e) => {
                            setNewVorlage(prev => {
                              const filter = { ...prev.filter }
                              if (filterKonfig.wert) {
                                filter[spalte.key] = { ...filterKonfig, op: e.target.value }
                              }
                              return { ...prev, filter }
                            })
                          }}
                          className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="enthält">enthält</option>
                          <option value="gleich">ist gleich</option>
                        </select>
                        {/* Wert-Eingabe */}
                        <input
                          type="text"
                          value={filterKonfig.wert}
                          onChange={(e) => {
                            const wert = e.target.value
                            setNewVorlage(prev => {
                              const filter = { ...prev.filter }
                              if (wert) {
                                filter[spalte.key] = { op: filterKonfig.op, wert }
                              } else {
                                delete filter[spalte.key]
                              }
                              return { ...prev, filter }
                            })
                          }}
                          placeholder="Wert (| für ODER)"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

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
                {editiereVorlageId ? '💾 Änderungen speichern' : '💾 Vorlage speichern'}
              </button>
              <button
                onClick={handleAbbrechen}
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
