import { useState } from 'react'

const SHORTCUTS = [
  { key: 'Espacio', action: 'Reproducir / Pausar' },
  { key: '←', action: 'Retroceder 2s' },
  { key: '→', action: 'Avanzar 2s' },
  { key: 'Alt + ←', action: 'Retroceder 0.04s (frame)' },
  { key: 'Alt + →', action: 'Avanzar 0.04s (frame)' },
  { key: 'Escape', action: 'Cerrar modal' },
]

export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="shortcuts">
      <button
        className="shortcuts-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="6" y1="8" x2="6" y2="8" />
          <line x1="10" y1="8" x2="18" y2="8" />
          <line x1="6" y1="12" x2="6" y2="12" />
          <line x1="10" y1="12" x2="18" y2="12" />
          <line x1="6" y1="16" x2="18" y2="16" />
        </svg>
        {isOpen ? 'Ocultar atajos' : 'Mostrar atajos de teclado'}
        <svg
          className={`chevron ${isOpen ? 'open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {isOpen && (
        <div className="shortcut-grid">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="shortcut-item">
              <kbd>{s.key}</kbd>
              <span>{s.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

