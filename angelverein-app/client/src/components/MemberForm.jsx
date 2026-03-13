import { useState } from 'react'

function MemberForm({ spalten, member, onSave, onCancel }) {
  const isEdit = !!member

  // Formular-Daten initialisieren
  const initialData = {}
  for (const spalte of spalten) {
    if (member && member[spalte.key] !== undefined) {
      initialData[spalte.key] = member[spalte.key]
    } else {
      initialData[spalte.key] = spalte.type === 'boolean' ? false : ''
    }
  }
  if (member?.id) initialData.id = member.id

  const [formData, setFormData] = useState(initialData)
  const [errors, setErrors] = useState({})

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    // Fehler für dieses Feld entfernen
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validate = () => {
    const newErrors = {}
    for (const spalte of spalten) {
      if (spalte.required) {
        const value = formData[spalte.key]
        if (value === '' || value === null || value === undefined) {
          newErrors[spalte.key] = `${spalte.label} ist ein Pflichtfeld`
        }
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSave(formData)
    }
  }

  const renderField = (spalte) => {
    const value = formData[spalte.key]
    const hasError = !!errors[spalte.key]
    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      hasError ? 'border-red-300 bg-red-50' : 'border-gray-300'
    }`

    // Readonly-Felder werden grau und nicht editierbar angezeigt.
    // Der Wert kommt vom Backend (wird dort automatisch berechnet).
    if (spalte.readonly) {
      return (
        <input
          type="text"
          value={value ?? ''}
          readOnly
          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
        />
      )
    }

    switch (spalte.type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(spalte.key, e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{spalte.label}</span>
          </label>
        )

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(spalte.key, e.target.value)}
            className={baseClasses}
          >
            <option value="">— Bitte wählen —</option>
            {(spalte.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => handleChange(spalte.key, e.target.value)}
            className={baseClasses}
          />
        )

      case 'email':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => handleChange(spalte.key, e.target.value)}
            placeholder={spalte.label}
            className={baseClasses}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(spalte.key, e.target.value)}
            placeholder={spalte.label}
            className={baseClasses}
          />
        )

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(spalte.key, e.target.value)}
            placeholder={spalte.label}
            className={baseClasses}
          />
        )
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">
          {isEdit ? '✏️ Mitglied bearbeiten' : '➕ Neues Mitglied anlegen'}
        </h2>
        {isEdit && (
          <p className="text-sm text-gray-500 mt-1">
            ID: {member.id} | Erstellt: {member.erstellt_am}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spalten.map(spalte => (
            <div key={spalte.key} className={spalte.type === 'boolean' ? 'flex items-end' : ''}>
              {spalte.type !== 'boolean' && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {spalte.label}
                  {spalte.required && <span className="text-red-500 ml-1">*</span>}
                  {spalte.readonly && <span className="text-gray-400 text-xs ml-1">(automatisch)</span>}
                </label>
              )}
              {renderField(spalte)}
              {errors[spalte.key] && (
                <p className="text-red-500 text-xs mt-1">{errors[spalte.key]}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {isEdit ? 'Speichern' : 'Anlegen'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}

export default MemberForm
