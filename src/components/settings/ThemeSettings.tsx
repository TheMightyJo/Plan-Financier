import type { Dispatch, SetStateAction } from 'react'
import { InfoHint } from '../InfoHint'
import { COLOR_PALETTES, type PaletteId } from '../../lib/appearance'

type Props = {
  theme: 'dark' | 'light' | 'system'
  setTheme: Dispatch<SetStateAction<'dark' | 'light' | 'system'>>
  palette: PaletteId
  setPalette: Dispatch<SetStateAction<PaletteId>>
}

/** Paramètres → Thème : mode clair/sombre/système et palette d'accent. */
export function ThemeSettings({ theme, setTheme, palette, setPalette }: Props) {
  return (
    <div className="settings-section-grid">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>
            Thème
            <InfoHint text="Le mode Système suit automatiquement les préférences (clair/sombre) de votre appareil." />
          </h2>
          <p>Choisissez l'apparence de l'application.</p>
        </div>
        <div className="theme-picker">
          {([
            ['dark',   '🌙', 'Sombre'],
            ['light',  '☀️', 'Clair'],
            ['system', '💻', 'Système'],
          ] as const).map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              className={`theme-option${theme === value ? ' theme-option--active' : ''}`}
              onClick={() => setTheme(value)}
            >
              <span className="theme-option-icon">{icon}</span>
              <span>{label}</span>
              {theme === value ? <span className="theme-option-state">✓ sélectionné</span> : null}
            </button>
          ))}
        </div>
        <div className="panel-title" style={{ marginTop: '0.9rem' }}>
          <h2>Palette de couleurs</h2>
          <p>La teinte d'accent utilisée par les boutons, liens et indicateurs.</p>
        </div>
        <div className="palette-picker" role="listbox" aria-label="Palettes de couleurs">
          {COLOR_PALETTES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={palette === entry.id}
              className={`palette-option${palette === entry.id ? ' palette-option--active' : ''}`}
              onClick={() => setPalette(entry.id)}
            >
              <span className="palette-dots" aria-hidden="true">
                <span style={{ background: entry.dots[0] }} />
                <span style={{ background: entry.dots[1] }} />
              </span>
              <span>{entry.label}</span>
              {palette === entry.id ? <span className="theme-option-state">✓</span> : null}
            </button>
          ))}
        </div>
      </article>
    </div>
  )
}
