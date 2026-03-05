import { useState, useEffect } from 'react'

const API_BASE = '/api'

function LoginPage({ vereinsname, onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)

  useEffect(() => {
    // Prüfen ob Setup nötig ist (erster Start)
    fetch(`${API_BASE}/auth/setup`)
      .then(res => res.json())
      .then(data => {
        setIsSetup(data.setupErforderlich)
        setCheckingSetup(false)
      })
      .catch(() => setCheckingSetup(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isSetup) {
      // Setup: Ersten Benutzer anlegen
      if (password !== confirmPassword) {
        setError('Passwörter stimmen nicht überein')
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setError('Passwort muss mindestens 6 Zeichen lang sein')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_BASE}/auth/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.fehler || 'Setup fehlgeschlagen')
        }
        onLogin(data.benutzer)
      } catch (err) {
        setError(err.message)
      }
    } else {
      // Login
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.fehler || 'Login fehlgeschlagen')
        }
        onLogin(data.benutzer)
      } catch (err) {
        setError(err.message)
      }
    }

    setLoading(false)
  }

  if (checkingSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-xl text-gray-500">Lade...</div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="text-6xl">🎣</span>
            <h1 className="text-2xl font-bold text-gray-800 mt-4">
              {vereinsname || 'Angelverein'}
            </h1>
            <p className="text-gray-500 mt-1">Mitgliederverwaltung</p>
          </div>

          {/* Setup-Hinweis */}
          {isSetup && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 text-sm">🔧 Ersteinrichtung</h3>
              <p className="text-blue-600 text-sm mt-1">
                Willkommen! Erstelle jetzt deinen Admin-Account, um die Verwaltung zu nutzen.
              </p>
            </div>
          )}

          {/* Fehler */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Formular */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Benutzername eingeben"
                required
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Passwort eingeben"
                required
                autoComplete={isSetup ? 'new-password' : 'current-password'}
              />
            </div>

            {isSetup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort bestätigen
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Passwort wiederholen"
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading 
                ? '⏳ Bitte warten...' 
                : isSetup 
                  ? '🔧 Account erstellen & starten' 
                  : '🔑 Anmelden'
              }
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              🔒 Geschützte Verbindung
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
