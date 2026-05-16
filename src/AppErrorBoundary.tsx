import { Component, type ErrorInfo, type ReactNode } from 'react'
import { supabase } from './supabase'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
  errorMessage: string
  incidentId: string
  copied: boolean
}

const createIncidentId = () =>
  `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    incidentId: '',
    copied: false,
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Une erreur inattendue est survenue.',
      incidentId: createIncidentId(),
      copied: false,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erreur interface capturée:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '', incidentId: '', copied: false })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleBackToLogin = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Si la deconnexion echoue, on force quand meme le retour a l'accueil.
    }

    window.location.assign('/')
  }

  handleCopyReport = async () => {
    const report = [
      `Incident: ${this.state.incidentId}`,
      `Message: ${this.state.errorMessage}`,
      `Date: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(report)
      this.setState({ copied: true })
      window.setTimeout(() => this.setState({ copied: false }), 1800)
    } catch {
      this.setState({ copied: false })
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="app-error-screen" role="alert" aria-live="assertive">
        <section className="app-error-card">
          <div className="app-error-layout">
            <div>
              <div className="app-error-badge-row">
                <p className="app-error-eyebrow">Plan Financier Assistance</p>
                <span className="app-error-pill">Recuperation guidee</span>
              </div>

              <h1>Un incident a interrompu l'affichage</h1>
              <p className="app-error-copy">
                Rien n'est perdu. Vos donnees locales sont conservees et vous pouvez reprendre en quelques secondes.
              </p>

              <ul className="app-error-steps" aria-label="Etapes de resolution rapide">
                <li>1. Essayez d'abord Reessayer pour reprendre sans quitter la session.</li>
                <li>2. Si besoin, rechargez la page pour repartir proprement.</li>
                <li>3. En dernier recours, copiez le rapport puis revenez sur l'ecran de connexion.</li>
              </ul>

              <div className="app-error-actions">
                <button type="button" className="app-error-btn app-error-btn--primary" onClick={this.handleRetry}>
                  Reessayer
                </button>
                <button type="button" className="app-error-btn" onClick={this.handleReload}>
                  Recharger la page
                </button>
                <button type="button" className="app-error-btn" onClick={this.handleCopyReport}>
                  {this.state.copied ? 'Rapport copie' : 'Copier le rapport'}
                </button>
                <button type="button" className="app-error-btn app-error-btn--ghost" onClick={this.handleBackToLogin}>
                  Retour connexion
                </button>
              </div>

              <details className="app-error-details">
                <summary>Details techniques</summary>
                <p>
                  <strong>ID incident:</strong> {this.state.incidentId}
                </p>
                <p>
                  <strong>Message:</strong> {this.state.errorMessage}
                </p>
              </details>
            </div>

            <aside className="app-error-visual" aria-hidden="true">
              <svg viewBox="0 0 280 220" className="app-error-illustration" focusable="false">
                <defs>
                  <linearGradient id="pfGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <rect x="26" y="28" width="228" height="156" rx="20" fill="rgba(255,255,255,0.08)" />
                <rect x="42" y="46" width="196" height="18" rx="9" fill="rgba(255,255,255,0.2)" />
                <rect x="42" y="78" width="134" height="12" rx="6" fill="rgba(255,255,255,0.14)" />
                <rect x="42" y="98" width="172" height="12" rx="6" fill="rgba(255,255,255,0.1)" />
                <circle cx="214" cy="144" r="38" fill="url(#pfGlow)" />
                <path d="M205 144h18M214 135v18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <circle cx="76" cy="157" r="9" fill="rgba(255,255,255,0.22)" />
                <circle cx="102" cy="157" r="9" fill="rgba(255,255,255,0.16)" />
                <circle cx="128" cy="157" r="9" fill="rgba(255,255,255,0.12)" />
              </svg>
            </aside>
          </div>
        </section>
      </main>
    )
  }
}

export default AppErrorBoundary