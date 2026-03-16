import { useState, useEffect } from 'react'
import { blobAlsDateiSpeichern } from '../utils/downloadHelper'

const API_BASE = '/api'

// Hilfsfunktion: Details-Objekt aus dem Audit-Log leserlich anzeigen
function formatDetails(details) {
  if (!details) return '–'
  if (typeof details === 'string') return details

  // Massenimport: { erstellt, aktualisiert }
  if ('erstellt' in details || 'aktualisiert' in details) {
    return `${details.erstellt ?? 0} erstellt, ${details.aktualisiert ?? 0} aktualisiert`
  }
  // Mitglied geändert: { aenderungen: { feld: { vorher, nachher } } }
  if (details.aenderungen) {
    return Object.entries(details.aenderungen)
      .map(([k, v]) => `${k}: ${v.vorher ?? '–'} → ${v.nachher ?? '–'}`)
      .join(', ')
  }
  // Rolle geändert: { vorher, nachher }
  if ('vorher' in details && 'nachher' in details) {
    return `${details.vorher} → ${details.nachher}`
  }
  // Mitglied erstellt/gelöscht: { name }
  if (details.name) return details.name
  // Benutzer erstellt: { username, rolle }
  if (details.username) return `${details.username}${details.rolle ? ` (${details.rolle})` : ''}`
  return JSON.stringify(details)
}

function AdminPanel({ onNotification, spalten, loadConfig }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', rolle: 'viewer' })
  // Welcher Tab gerade aktiv ist: 'benutzer', 'spalten' oder 'audit'
  const [activeTab, setActiveTab] = useState('benutzer')

  // Passwort-Modal: null = geschlossen, { id, username } = offen
  const [passwortModal, setPasswortModal] = useState(null)
  const [neuesPasswort, setNeuesPasswort] = useState('')

  // Rollen-Modal: null = geschlossen, { id, username, rolle } = offen
  const [rolleModal, setRolleModal] = useState(null)
  const [gewaehlteRolle, setGewaehlteRolle] = useState('')

  // Audit-Log States
  const [auditLog, setAuditLog] = useState([])
  const [auditGesamt, setAuditGesamt] = useState(0)
  const [auditSeiten, setAuditSeiten] = useState(1)
  const [auditSeite, setAuditSeite] = useState(1)
  const [auditAktionen, setAuditAktionen] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFilter, setAuditFilter] = useState({ von: '', bis: '', aktion: '' })

  const loadAuditLog = async () => {
    setAuditLoading(true)
    try {
      const params = new URLSearchParams({ seite: auditSeite })
      if (auditFilter.von)    params.set('von', auditFilter.von)
      if (auditFilter.bis)    params.set('bis', auditFilter.bis)
      if (auditFilter.aktion) params.set('aktion', auditFilter.aktion)
      const res = await fetch(`${API_BASE}/audit?${params}`)
      const data = await res.json()
      setAuditLog(data.eintraege)
      setAuditGesamt(data.gesamt)
      setAuditSeiten(data.seiten)
    } catch (err) {
      console.error('Fehler beim Laden des Audit-Logs:', err)
      onNotification('Fehler beim Laden des Audit-Logs', 'error')
    }
    setAuditLoading(false)
  }

  const loadAuditAktionen = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit/aktionen`)
      const data = await res.json()
      setAuditAktionen(data)
    } catch (err) {
      console.error('Fehler beim Laden der Audit-Aktionen:', err)
    }
  }

  // Audit-Log als Datei herunterladen (CSV oder JSON)
  const exportAuditLog = async (format) => {
    const params = new URLSearchParams({ format })
    if (auditFilter.von)    params.set('von', auditFilter.von)
    if (auditFilter.bis)    params.set('bis', auditFilter.bis)
    if (auditFilter.aktion) params.set('aktion', auditFilter.aktion)

    try {
      const res = await fetch(`${API_BASE}/audit/export?${params}`)
      if (!res.ok) throw new Error('Export fehlgeschlagen')

      // Antwort als Blob (Rohdaten) empfangen und als Download-Link auslösen
      const blob = await res.blob()
      blobAlsDateiSpeichern(blob, `audit-log-${new Date().toISOString().slice(0, 10)}.${format}`)
    } catch (err) {
      console.error('Audit-Export Fehler:', err)
      onNotification('Fehler beim Exportieren des Audit-Logs', 'error')
    }
  }

  useEffect(() => {
    loadUsers()
    loadAuditAktionen()
  }, [])

  // Audit-Log neu laden wenn Tab aktiv oder Filter/Seite ändert
  useEffect(() => {
    if (activeTab === 'audit') loadAuditLog()
  }, [activeTab, auditSeite, auditFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/users`)
      if (res.status === 401) {
        window.location.reload()
        return
      }
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      console.error('Fehler beim Laden der Nutzer:', err)
      onNotification('Fehler beim Laden der Nutzer', 'error')
    }
    setLoading(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newUser.username || !newUser.password) return
    if (newUser.password.length < 6) {
      onNotification('Passwort muss mindestens 6 Zeichen lang sein', 'error')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.fehler || 'Fehler')
      onNotification('Nutzer erstellt')
      setShowCreate(false)
      setNewUser({ username: '', password: '', rolle: 'viewer' })
      loadUsers()
    } catch (err) {
      onNotification(err.message, 'error')
    }
  }

  // Öffnet das Passwort-Modal für einen Benutzer
  const changePassword = (user) => {
    setNeuesPasswort('')
    setPasswortModal({ id: user.id, username: user.username })
  }

  // Speichert das neue Passwort aus dem Modal
  const handlePasswortSpeichern = async () => {
    if (neuesPasswort.length < 6) {
      onNotification('Passwort muss mindestens 6 Zeichen lang sein', 'error')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/auth/users/${passwortModal.id}/passwort`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neuesPasswort })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.fehler || 'Fehler')
      onNotification('Passwort zurückgesetzt')
      setPasswortModal(null)
    } catch (err) {
      onNotification(err.message, 'error')
    }
  }

  // Öffnet das Rollen-Modal für einen Benutzer
  const changeRole = (user) => {
    setGewaehlteRolle(user.rolle)
    setRolleModal({ id: user.id, username: user.username })
  }

  // Speichert die neue Rolle aus dem Modal
  const handleRolleSpeichern = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/users/${rolleModal.id}/rolle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolle: gewaehlteRolle })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.fehler || 'Fehler')
      }
      onNotification('Rolle aktualisiert')
      setRolleModal(null)
      loadUsers()
    } catch (err) {
      onNotification(err.message, 'error')
    }
  }

  const deleteUser = async (user) => {
    if (!confirm(`Nutzer ${user.username} wirklich löschen?`)) return
    try {
      const res = await fetch(`${API_BASE}/auth/users/${user.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.fehler || 'Fehler')
      }
      onNotification('Nutzer gelöscht')
      loadUsers()
    } catch (err) {
      onNotification(err.message, 'error')
    }
  }

  // Sichtbarkeit einer Spalte umschalten und config neu laden
  const toggleSpalte = async (spalte) => {
    try {
      const res = await fetch(`${API_BASE}/settings/spalten/${encodeURIComponent(spalte.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sichtbar: !spalte.sichtbar })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.fehler || 'Fehler')
      }
      // Config neu laden → MemberTable zeigt sofort die neue Spaltenauswahl
      loadConfig()
    } catch (err) {
      onNotification(err.message, 'error')
    }
  }

  if (loading) {
    return <div>Lade Nutzer…</div>
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🔧 Admin-Bereich</h2>

      {/* Tab-Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('benutzer')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'benutzer'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Benutzerverwaltung
        </button>
        <button
          onClick={() => setActiveTab('spalten')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'spalten'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Spalten-Anzeige
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'audit'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Audit-Log
        </button>
      </div>

      {/* Tab: Benutzerverwaltung */}
      {activeTab === 'benutzer' && (
        <div>
          {showCreate ? (
            <form onSubmit={handleCreate} className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700">Benutzername</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Passwort</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rolle</label>
                <select
                  value={newUser.rolle}
                  onChange={e => setNewUser({ ...newUser, rolle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">Erstellen</button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg mb-4"
            >
              + Neuer Nutzer
            </button>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Benutzername</th>
                  <th className="px-4 py-2 text-left">Rolle</th>
                  <th className="px-4 py-2 text-left">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-2">{u.id}</td>
                    <td className="px-4 py-2">{u.username}</td>
                    <td className="px-4 py-2 capitalize">{u.rolle}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => changePassword(u)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Passwort
                        </button>
                        <button
                          onClick={() => changeRole(u)}
                          className="text-green-600 hover:underline text-xs"
                        >
                          Rolle
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Audit-Log */}
      {activeTab === 'audit' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Alle Änderungen werden hier protokolliert. Einträge werden 12 Monate aufbewahrt.
          </p>

          {/* Filterzeile */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Von</label>
              <input
                type="date"
                value={auditFilter.von}
                onChange={e => { setAuditSeite(1); setAuditFilter(f => ({ ...f, von: e.target.value })) }}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bis</label>
              <input
                type="date"
                value={auditFilter.bis}
                onChange={e => { setAuditSeite(1); setAuditFilter(f => ({ ...f, bis: e.target.value })) }}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Aktion</label>
              <select
                value={auditFilter.aktion}
                onChange={e => { setAuditSeite(1); setAuditFilter(f => ({ ...f, aktion: e.target.value })) }}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Alle</option>
                {auditAktionen.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="self-end">
              <button
                onClick={() => { setAuditSeite(1); setAuditFilter({ von: '', bis: '', aktion: '' }) }}
                className="px-3 py-1 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              >
                Zurücksetzen
              </button>
            </div>
            <div className="self-end flex gap-2 ml-auto">
              {/* Export-Buttons: aktuelle Filtereinstellungen werden mitgegeben */}
              <button
                onClick={() => exportAuditLog('csv')}
                className="px-3 py-1 text-sm bg-blue-50 border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
              >
                CSV exportieren
              </button>
              <button
                onClick={() => exportAuditLog('json')}
                className="px-3 py-1 text-sm bg-blue-50 border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
              >
                JSON exportieren
              </button>
            </div>
          </div>

          {/* Tabelle */}
          {auditLoading ? (
            <div className="text-sm text-gray-500">Lade…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 whitespace-nowrap">Zeitstempel</th>
                    <th className="px-3 py-2">Benutzer</th>
                    <th className="px-3 py-2">Aktion</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-gray-400">Keine Einträge gefunden</td>
                    </tr>
                  ) : auditLog.map(eintrag => (
                    <tr key={eintrag.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                        {new Date(eintrag.zeitstempel).toLocaleString('de-DE')}
                      </td>
                      <td className="px-3 py-2">{eintrag.benutzername ?? '–'}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                          {eintrag.aktion}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate" title={typeof eintrag.details === 'object' ? JSON.stringify(eintrag.details) : eintrag.details}>
                        {formatDetails(eintrag.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginierung */}
          {auditSeiten > 1 && (
            <div className="flex items-center gap-3 mt-4 text-sm">
              <button
                onClick={() => setAuditSeite(s => Math.max(1, s - 1))}
                disabled={auditSeite <= 1}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                &lsaquo; Zurück
              </button>
              <span className="text-gray-600">
                Seite {auditSeite} von {auditSeiten} ({auditGesamt} Einträge)
              </span>
              <button
                onClick={() => setAuditSeite(s => Math.min(auditSeiten, s + 1))}
                disabled={auditSeite >= auditSeiten}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Weiter &rsaquo;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Spalten-Anzeige */}
      {activeTab === 'spalten' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Lege fest, welche Spalten in der Mitgliedertabelle angezeigt werden.
          </p>
          <div className="space-y-2 max-w-md">
            {(spalten || []).map(spalte => (
              <div
                key={spalte.key}
                className="flex items-center justify-between p-3 border rounded-lg bg-white"
              >
                <div>
                  <span className="font-medium text-gray-800">{spalte.label}</span>
                  <span className="ml-2 text-xs text-gray-400">({spalte.key})</span>
                </div>
                {/* Toggle-Schalter */}
                <button
                  onClick={() => toggleSpalte(spalte)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    spalte.sichtbar !== false ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  title={spalte.sichtbar !== false ? 'Sichtbar – klicken zum Ausblenden' : 'Ausgeblendet – klicken zum Einblenden'}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      spalte.sichtbar !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Passwort zurücksetzen */}
      {passwortModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Passwort für {passwortModal.username}</h3>
            <input
              type="password"
              placeholder="Neues Passwort (mind. 6 Zeichen)"
              value={neuesPasswort}
              onChange={e => setNeuesPasswort(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswortSpeichern()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPasswortModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={handlePasswortSpeichern}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rolle ändern */}
      {rolleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Rolle für {rolleModal.username}</h3>
            <select
              value={gewaehlteRolle}
              onChange={e => setGewaehlteRolle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRolleModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={handleRolleSpeichern}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
