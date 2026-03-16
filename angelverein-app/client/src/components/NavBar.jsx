// Navigationsleiste der App – Desktop und Mobile in einer Komponente.
// Alle Nav-Einträge sind in einem Array definiert, damit Desktop und Mobile
// dieselbe Quelle nutzen und nichts doppelt gepflegt werden muss.

// Nav-Einträge: id = View-Name, label = Beschriftung, rolle = wer darf es sehen
// null = alle, 'editor' = editor + admin, 'admin' = nur admin
const NAV_EINTRAEGE = [
  { id: 'dashboard',  label: '🏠 Startseite',       rolle: null },
  { id: 'liste',      label: '📋 Mitgliederliste',   rolle: null },
  { id: 'formular',   label: '➕ Neues Mitglied',     rolle: 'editor' },
  { id: 'fische',     label: '🐟 Fische',            rolle: 'editor' },
  { id: 'terminplan', label: '📅 Terminplan',         rolle: null },
  { id: 'export',     label: '📄 PDF-Export',         rolle: 'editor' },
  { id: 'import',     label: '📥 Import & Abgleich',  rolle: 'admin' },
  { id: 'admin',      label: '🛠️ Admin',              rolle: 'admin' },
]

export default function NavBar({ activeView, setActiveView, isEditor, isAdmin, onNewMember, mobileNavOpen, setMobileNavOpen }) {
  // Prüft ob der aktuelle Benutzer einen Nav-Eintrag sehen darf
  const darfSehen = (eintrag) => {
    if (eintrag.rolle === 'admin') return isAdmin
    if (eintrag.rolle === 'editor') return isEditor
    return true
  }

  // Beim Klick auf einen Nav-Eintrag: View wechseln und ggf. Sonderaktion ausführen
  const handleKlick = (eintrag, mobil = false) => {
    if (eintrag.id === 'formular') {
      onNewMember()
    } else {
      setActiveView(eintrag.id)
    }
    if (mobil) setMobileNavOpen(false)
  }

  // Klassen für aktiven vs. inaktiven Button
  const buttonKlasse = (id, extra = '') =>
    `${extra} px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeView === id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4">

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1 py-2">
          {NAV_EINTRAEGE.filter(darfSehen).map(eintrag => (
            <button
              key={eintrag.id}
              onClick={() => handleKlick(eintrag)}
              className={buttonKlasse(eintrag.id)}
            >
              {eintrag.label}
            </button>
          ))}
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center justify-between py-2">
          {/* Aktuell aktiver View als Beschriftung */}
          <span className="text-sm font-medium text-gray-700">
            {NAV_EINTRAEGE.find(e => e.id === activeView)?.label ?? ''}
          </span>
          <button
            onClick={() => setMobileNavOpen(o => !o)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Menü öffnen"
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileNavOpen && (
          <div className="md:hidden pb-2 flex flex-col gap-1">
            {NAV_EINTRAEGE.filter(darfSehen).map(eintrag => (
              <button
                key={eintrag.id}
                onClick={() => handleKlick(eintrag, true)}
                className={buttonKlasse(eintrag.id, 'w-full text-left')}
              >
                {eintrag.label}
              </button>
            ))}
          </div>
        )}

      </div>
    </nav>
  )
}
