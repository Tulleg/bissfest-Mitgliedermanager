import { useState, useEffect } from 'react'

const API_BASE = '/api'

function AdminPanel({ onNotification }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', rolle: 'viewer' })

  useEffect(() => {
    loadUsers()
  }, [])

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

  const changePassword = async (user) => {
    const pwd = prompt(`Neues Passwort für ${user.username} (mind. 6 Zeichen)`)
    if (!pwd) return
    if (pwd.length < 6) {
      onNotification('Passwort zu kurz', 'error')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/auth/users/${user.id}/passwort`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neuesPasswort: pwd })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.fehler || 'Fehler')
      onNotification('Passwort zurückgesetzt')
    } catch (err) {
      onNotification(err.message, 'error')
    }
  }

  const changeRole = async (user) => {
    const rolle = prompt(
      `Rolle für ${user.username} (viewer, editor, admin):`,
      user.rolle
    )
    if (!rolle) return
    if (!['viewer', 'editor', 'admin'].includes(rolle)) {
      onNotification('Ungültige Rolle', 'error')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/auth/users/${user.id}/rolle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolle })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.fehler || 'Fehler')
      }
      onNotification('Rolle aktualisiert')
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

  if (loading) {
    return <div>Lade Nutzer…</div>
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🔧 Admin-Bereich</h2>

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

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Benutzername</th>
            <th className="px-4 py-2">Rolle</th>
            <th className="px-4 py-2">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t">
              <td className="px-4 py-2">{u.id}</td>
              <td className="px-4 py-2">{u.username}</td>
              <td className="px-4 py-2 capitalize">{u.rolle}</td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
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
  )
}

export default AdminPanel
