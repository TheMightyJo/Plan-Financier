import type { Dispatch, SetStateAction } from 'react'
import type { A11yPrefs } from '../../lib/appearance'

type Props = {
  a11yPrefs: A11yPrefs
  setA11yPrefs: Dispatch<SetStateAction<A11yPrefs>>
}

/** Paramètres → Accessibilité : taille du texte, animations, contraste. */
export function A11ySettings({ a11yPrefs, setA11yPrefs }: Props) {
  return (
    <div className="settings-section-grid settings-section-grid--single">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>
            ♿ Accessibilité
           
          </h2>
          <p>Adaptez l'application à vos besoins de lecture et de confort.</p>
        </div>

        <span className="ai-provider-label">Taille du texte</span>
        <div className="theme-picker">
          {([
            ['normal', 'Aa', 'Normale'],
            ['large', 'Aa', 'Grande'],
            ['xl', 'Aa', 'Très grande'],
          ] as const).map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              className={`theme-option a11y-size-option a11y-size-option--${value}${a11yPrefs.textSize === value ? ' theme-option--active' : ''}`}
              onClick={() => setA11yPrefs((previous) => ({ ...previous, textSize: value }))}
            >
              <span className="theme-option-icon">{icon}</span>
              <span>{label}</span>
              {a11yPrefs.textSize === value ? <span className="theme-option-state">✓</span> : null}
            </button>
          ))}
        </div>

        <label className="a11y-toggle">
          <input
            type="checkbox"
            checked={a11yPrefs.reduceMotion}
            onChange={(event) =>
              setA11yPrefs((previous) => ({ ...previous, reduceMotion: event.target.checked }))
            }
          />
          <span>
            <strong>Réduire les animations</strong>
            <small>Désactive les mouvements (coucou 👋, jauges animées, transitions).</small>
          </span>
        </label>

        <label className="a11y-toggle">
          <input
            type="checkbox"
            checked={a11yPrefs.highContrast}
            onChange={(event) =>
              setA11yPrefs((previous) => ({ ...previous, highContrast: event.target.checked }))
            }
          />
          <span>
            <strong>Contraste renforcé</strong>
            <small>Textes secondaires plus foncés et bordures plus marquées.</small>
          </span>
        </label>

      </article>
    </div>
  )
}
