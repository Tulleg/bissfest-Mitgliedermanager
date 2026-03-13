import { useState, useEffect, useRef } from 'react'
import MemberTable from './components/MemberTable'
import MemberForm from './components/MemberForm'
import ExportDialog from './components/ExportDialog'
import ImportDialog from './components/ImportDialog'
import LoginPage from './components/LoginPage'
import AdminPanel from './components/AdminPanel'
import Dashboard from './components/Dashboard'
import FischVerwaltung from './components/FischVerwaltung'

const API_BASE = '/api'

function App() {
  const [config, setConfig] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('dashboard') // dashboard, liste, formular, export, import, admin, fische

  const [editMember, setEditMember] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState(null)

  // Auth State
  const [authChecking, setAuthChecking] = useState(true)
  const [user, setUser] = useState(null)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ altesPasswort: '', neuesPasswort: '', bestaetigung: '' })

  // Benutzerspezifische Spalten-Sichtbarkeit (nur für editor/admin)
  const [userSpaltenPrefs, setUserSpaltenPrefs] = useState({})

  // Mobile UI State
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // Auth-Status prüfen beim Start
  useEffect(() => {
    fetch(`${API_BASE}/auth/check`)
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) {
          setUser(data.benutzer)
          loadUserSpaltenPrefs(data.benutzer.rolle)
        }
        setAuthChecking(false)
      })
      .catch(() => setAuthChecking(false))
  }, [])

  // Config laden – als Funktion, damit sie auch nach Spalten-Änderung neu aufgerufen werden kann
  const loadConfig = () => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Config-Fehler:', err))
  }

  useEffect(() => {
    loadConfig()
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

  // Spalten-Prefs des eingeloggten Benutzers vom Server laden
  // Viewer überspringen – sie nutzen immer den Admin-Standard
  const loadUserSpaltenPrefs = async (rolle) => {
    if (rolle === 'viewer') return
    try {
      const res = await fetch(`${API_BASE}/auth/user/spalten`)
      if (res.ok) {
        const prefs = await res.json()
        setUserSpaltenPrefs(prefs)
      }
    } catch (err) {
      console.error('Fehler beim Laden der Spalten-Prefs:', err)
    }
  }

  const handleLogin = (benutzer) => {
    setUser(benutzer)
    loadUserSpaltenPrefs(benutzer.rolle)
  }

  // Eine Spalte ein- oder ausblenden und in der DB speichern
  const handleSpalteToggle = async (key, sichtbar) => {
    // Lokal sofort aktualisieren (UI reagiert direkt)
    setUserSpaltenPrefs(prev => ({ ...prev, [key]: sichtbar }))
    try {
      await fetch(`${API_BASE}/auth/user/spalten/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sichtbar })
      })
    } catch (err) {
      console.error('Fehler beim Speichern der Spalten-Pref:', err)
    }
  }

  const isAdmin = user?.rolle === 'admin';
  const isEditor = isAdmin || user?.rolle === 'editor';
  const isViewer = user?.rolle === 'viewer';


  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' })
    } catch (err) {
      console.error('Logout-Fehler:', err)
    }
    setUser(null)
    setMembers([])
    setActiveView('dashboard')
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
    if (!isEditor) {
      showNotification('Keine Berechtigung zum Anlegen von Mitgliedern', 'error')
      return
    }
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
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity text-left"
            >
              <span className="text-2xl flex-shrink-0">🎣</span>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold truncate">{config.vereinsname}</h1>
                <p className="text-blue-200 text-xs hidden sm:block">Mitgliederverwaltung · v{config.version}</p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline bg-blue-500 px-3 py-1 rounded-full text-sm">
                {members.length} Mitglieder
              </span>
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(o => !o)}
                  className="bg-blue-500 hover:bg-blue-400 px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1"
                >
                  👤 <span className="hidden sm:inline">{user.username}</span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50">
                    <button
                      onClick={() => { setShowPasswordChange(true); setUserMenuOpen(false) }}
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
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 py-2">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              🏠 Startseite
            </button>
            <button
              onClick={() => { setActiveView('liste'); setEditMember(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'liste' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              📋 Mitgliederliste
            </button>
            {isEditor && (
              <button
                onClick={handleNewMember}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'formular' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                ➕ Neues Mitglied
              </button>
            )}
            {isEditor && (
              <button
                onClick={() => setActiveView('fische')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'fische' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                🐟 Fische
              </button>
            )}
            {isEditor && (
              <button
                onClick={() => setActiveView('export')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'export' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                📄 PDF-Export
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setActiveView('import')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'import' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                📥 Import & Abgleich
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setActiveView('admin')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                🛠️ Admin
              </button>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center justify-between py-2">
            <span className="text-sm font-medium text-gray-700">
              {activeView === 'dashboard' && '🏠 Startseite'}
              {activeView === 'liste' && '📋 Mitgliederliste'}
              {activeView === 'formular' && '✏️ Mitglied'}
              {activeView === 'fische' && '🐟 Fischverwaltung'}
              {activeView === 'export' && '📄 PDF-Export'}
              {activeView === 'import' && '📥 Import'}
              {activeView === 'admin' && '🛠️ Admin'}
            </span>
            <button
              onClick={() => setMobileNavOpen(o => !o)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Menü öffnen"
            >
              {mobileNavOpen ? '✕' : '☰'}
            </button>
          </div>
          {mobileNavOpen && (
            <div className="md:hidden pb-2 flex flex-col gap-1">
              <button
                onClick={() => { setActiveView('dashboard'); setMobileNavOpen(false) }}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                🏠 Startseite
              </button>
              <button
                onClick={() => { setActiveView('liste'); setEditMember(null); setMobileNavOpen(false) }}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'liste' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                📋 Mitgliederliste
              </button>
              {isEditor && (
                <button
                  onClick={() => { handleNewMember(); setMobileNavOpen(false) }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'formular' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  ➕ Neues Mitglied
                </button>
              )}
              {isEditor && (
                <button
                  onClick={() => { setActiveView('fische'); setMobileNavOpen(false) }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'fische' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  🐟 Fische
                </button>
              )}
              {isEditor && (
                <button
                  onClick={() => { setActiveView('export'); setMobileNavOpen(false) }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'export' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  📄 PDF-Export
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setActiveView('import'); setMobileNavOpen(false) }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'import' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  📥 Import & Abgleich
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setActiveView('admin'); setMobileNavOpen(false) }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  🛠️ Admin
                </button>
              )}
            </div>
          )}
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
        {activeView === 'dashboard' && <Dashboard />}

        {activeView === 'fische' && isEditor && <FischVerwaltung />}

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
              {isEditor && (
                <button
                  onClick={handleNewMember}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex-shrink-0"
                >
                  <span className="hidden sm:inline">+ Neues Mitglied</span>
                  <span className="sm:hidden">+</span>
                </button>
              )}
            </div>

            <MemberTable
              members={members}
              spalten={isViewer
                ? config.spalten
                // Admin-Standard mit User-Prefs zusammenführen:
                // Hat der User eine eigene Einstellung → diese nutzen, sonst Admin-Standard
                : config.spalten.map(s => ({
                    ...s,
                    sichtbar: Object.prototype.hasOwnProperty.call(userSpaltenPrefs, s.key)
                      ? userSpaltenPrefs[s.key]
                      : s.sichtbar !== false
                  }))
              }
              loading={loading}
              onEdit={handleEditMember}
              onDelete={handleDeleteMember}
              onSpalteToggle={!isViewer ? handleSpalteToggle : undefined}
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

        {activeView === 'export' && isEditor && (
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

        {activeView === 'admin' && (
          <AdminPanel
                onNotification={showNotification}
                spalten={config?.spalten || []}
                loadConfig={loadConfig}
              />
        )}
      </main>
    </div>
  )
}

export default App
