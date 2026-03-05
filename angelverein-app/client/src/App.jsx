import { useState, useEffect } from 'react'
import MemberTable from './components/MemberTable'
import MemberForm from './components/MemberForm'
import ExportDialog from './components/ExportDialog'
import ImportDialog from './components/ImportDialog'
import LoginPage from './components/LoginPage'

const API_BASE = '/api'

function App() {
  const [config, setConfig] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('liste') // liste, formular, export, import
  const [editMember, setEditMember] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState(null)

  // Auth State
  const [authChecking, setAuthChecking] = useState(true)
  const [user, setUser] = useState(null)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ altesPasswort: '', neuesPasswort: '', bestaetigung: '' })

  // Auth-Status prüfen beim Start
  useEffect(() => {
    fetch(`${API_BASE}/auth/check`)
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) {
          setUser(data.benutzer)
        }
        setAuthChecking(false)
      })
      .catch(() => setAuthChecking(false))
  }, [])

  // Config laden
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Config-Fehler:', err))
  }, [])

  // Mitglieder laden wenn eingeloggt
  useEffect(() => {
    if (user) {
      loadMembers()
    }
  }, [user])

  const loadMembers = async (query = '') => {
    setLoading(true)
    try {
      const url = query 
        ? `${API_BASE}/mitglieder?suche=${encodeURIComponent(query)}`
        : `${API_BASE}/mitglieder`
      const res = await fetch(url)
      if (res.status === 401) {
        setUser(null)
        return
      }
      const data = await res.json()
      setMembers(data)
    } catch (err) {
      console.error('Fehler beim Laden:', err)
      showNotification('Fehler beim Laden der Mitglieder', 'error')
    }
    setLoading(false)
  }

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleLogin = (benutzer) => {
    setUser(benutzer)
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' })
    } catch (err) {
      console.error('Logout-Fehler:', err)
    }
    setUser(null)
    setMembers([])
    setActiveView('liste')
    setEditMember(null)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (passwordForm.neuesPasswort !== passwordForm.bestaetigung) {
      showNotification('Passwörter stimmen nicht überein', 'error')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/auth/passwort-aendern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          altesPasswort: passwordForm.altesPasswort,
          neuesPasswort: passwordForm.neuesPasswort
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.fehler)
      showNotification('Passwort erfolgreich geändert')
      setShowPasswordChange(false)
      setPasswordForm({ altesPasswort: '', neuesPasswort: '', bestaetigung: '' })
    } catch (err) {
      showNotification(err.message, 'error')
    }
  }

  const handleSaveMember = async (data) => {
    try {
      const isEdit = !!data.id
      const url = isEdit ? `${API_BASE}/mitglieder/${data.id}` : `${API_BASE}/mitglieder`
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.status === 401) {
        setUser(null)
        return
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.fehler || 'Unbekannter Fehler')
      }

      showNotification(isEdit ? 'Mitglied aktualisiert' : 'Mitglied angelegt')
      setActiveView('liste')
      setEditMember(null)
      loadMembers()
    } catch (err) {
      showNotification(err.message, 'error')
    }
  }

  const handleDeleteMember = async (id) => {
    if (!confirm('Mitglied wirklich löschen?')) return
    
    try {
      const res = await fetch(`${API_BASE}/mitglieder/${id}`, { method: 'DELETE' })
      if (res.status === 401) {
        setUser(null)
        return
      }
      if (!res.ok) throw new Error('Fehler beim Löschen')
      showNotification('Mitglied gelöscht')
      loadMembers()
    } catch (err) {
      showNotification(err.message, 'error')
    }
  }

  const handleEditMember = (member) => {
    setEditMember(member)
    setActiveView('formular')
  }

  const handleNewMember = () => {
    setEditMember(null)
    setActiveView('formular')
  }

  const handleSearch = (e) => {
    const query = e.target.value
    setSearchQuery(query)
    if (query.length >= 2 || query.length === 0) {
      loadMembers(query)
    }
  }

  // Lade-Bildschirm
  if (authChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-xl text-gray-500">🎣 Lade...</div>
      </div>
    )
  }

  // Login-Seite wenn nicht eingeloggt
  if (!user) {
    return <LoginPage vereinsname={config?.vereinsname} onLogin={handleLogin} />
  }

  // Config noch nicht geladen
  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-500">Lade Konfiguration...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎣</span>
              <div>
                <h1 className="text-xl font-bold">{config.vereinsname}</h1>
                <p className="text-blue-200 text-sm">Mitgliederverwaltung</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-blue-500 px-3 py-1 rounded-full text-sm">
                {members.length} Mitglieder
              </span>
              <div className="relative group">
                <button className="bg-blue-500 hover:bg-blue-400 px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1">
                  👤 {user.username}
                </button>
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => setShowPasswordChange(true)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                  >
                    🔑 Passwort ändern
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                  >
                    🚪 Abmelden
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 py-2">
            <button
              onClick={() => { setActiveView('liste'); setEditMember(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === 'liste' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📋 Mitgliederliste
            </button>
            <button
              onClick={handleNewMember}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === 'formular' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ➕ Neues Mitglied
            </button>
            <button
              onClick={() => setActiveView('export')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === 'export' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📄 PDF-Export
            </button>
            <button
              onClick={() => setActiveView('import')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === 'import' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📥 Import & Abgleich
            </button>
          </div>
        </div>
      </nav>

      {/* Passwort-Ändern Dialog */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">🔑 Passwort ändern</h2>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aktuelles Passwort</label>
                <input
                  type="password"
                  value={passwordForm.altesPasswort}
                  onChange={(e) => setPasswordForm({...passwordForm, altesPasswort: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                <input
                  type="password"
                  value={passwordForm.neuesPasswort}
                  onChange={(e) => setPasswordForm({...passwordForm, neuesPasswort: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort bestätigen</label>
                <input
                  type="password"
                  value={passwordForm.bestaetigung}
                  onChange={(e) => setPasswordForm({...passwordForm, bestaetigung: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPasswordChange(false); setPasswordForm({ altesPasswort: '', neuesPasswort: '', bestaetigung: '' }); }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Benachrichtigung */}
      {notification && (
        <div className={`max-w-7xl mx-auto px-4 mt-4`}>
          <div className={`p-3 rounded-lg text-sm font-medium ${
            notification.type === 'error' 
              ? 'bg-red-100 text-red-700 border border-red-200' 
              : 'bg-green-100 text-green-700 border border-green-200'
          }`}>
            {notification.message}
          </div>
        </div>
      )}

      {/* Hauptinhalt */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeView === 'liste' && (
          <>
            {/* Suchleiste */}
            <div className="mb-4 flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Mitglieder suchen..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              </div>
              <button
                onClick={handleNewMember}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                + Neues Mitglied
              </button>
            </div>

            <MemberTable
              members={members}
              spalten={config.spalten}
              loading={loading}
              onEdit={handleEditMember}
              onDelete={handleDeleteMember}
            />
          </>
        )}

        {activeView === 'formular' && (
          <MemberForm
            spalten={config.spalten}
            member={editMember}
            onSave={handleSaveMember}
            onCancel={() => { setActiveView('liste'); setEditMember(null); }}
          />
        )}

        {activeView === 'export' && (
          <ExportDialog
            spalten={config.spalten}
            vereinsname={config.vereinsname}
          />
        )}

        {activeView === 'import' && (
          <ImportDialog
            spalten={config.spalten}
            onImportComplete={() => {
              loadMembers()
              showNotification('Import erfolgreich abgeschlossen')
            }}
          />
        )}
      </main>
    </div>
  )
}

export default App
