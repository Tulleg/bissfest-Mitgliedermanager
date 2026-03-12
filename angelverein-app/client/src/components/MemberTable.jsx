import { useState } from 'react'

function MemberTable({ members, spalten, loading, onEdit, onDelete, canEdit = true, canDelete = true }) {
  const [sortField, setSortField] = useState('nachname')
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedMembers = [...members].sort((a, b) => {
    const valA = String(a[sortField] || '').toLowerCase()
    const valB = String(b[sortField] || '').toLowerCase()
    const cmp = valA.localeCompare(valB, 'de')
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Nur sichtbare Spalten anzeigen (gesteuert über Admin-Panel)
  const visibleSpalten = spalten.filter(s => s.sichtbar !== false)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        Lade Mitglieder...
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-gray-500">Keine Mitglieder gefunden</p>
        <p className="text-gray-400 text-sm mt-1">Lege ein neues Mitglied an oder ändere die Suche</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th
                onClick={() => handleSort('id')}
                className="px-4 py-3 text-left font-medium text-gray-400 cursor-pointer hover:bg-gray-100 select-none w-16"
              >
                <div className="flex items-center gap-1">
                  ID
                  {sortField === 'id' && (
                    <span className="text-blue-500">
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              {visibleSpalten.map(spalte => (
                <th
                  key={spalte.key}
                  onClick={() => handleSort(spalte.key)}
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-1">
                    {spalte.label}
                    {sortField === spalte.key && (
                      <span className="text-blue-500">
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member, idx) => (
              <tr
                key={member.id}
                className={`border-b hover:bg-blue-50 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <td className="px-4 py-2.5 text-gray-400 text-sm">{member.id}</td>
                {visibleSpalten.map(spalte => (
                  <td key={spalte.key} className="px-4 py-2.5">
                    {renderCellValue(member[spalte.key], spalte)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <button
                        onClick={() => onEdit(member)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Bearbeiten"
                      >
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(member.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Löschen"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
        {members.length} Mitglied{members.length !== 1 ? 'er' : ''} angezeigt
      </div>
    </div>
  )
}

function renderCellValue(value, spalte) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-300">—</span>
  }

  if (spalte.type === 'boolean') {
    return value === 1 || value === true ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        ✓ Ja
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        ✗ Nein
      </span>
    )
  }

  if (spalte.type === 'select') {
    const colors = {
      'aktiv': 'bg-green-100 text-green-700',
      'passiv': 'bg-yellow-100 text-yellow-700',
      'ausgetreten': 'bg-red-100 text-red-700'
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-700'}`}>
        {value}
      </span>
    )
  }

  if (spalte.type === 'email') {
    return <a href={`mailto:${value}`} className="text-blue-600 hover:underline">{value}</a>
  }

  return String(value)
}

export default MemberTable
