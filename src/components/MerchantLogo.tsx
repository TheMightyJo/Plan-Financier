import { useState } from 'react'
import { guessMerchantDomains, merchantFaviconUrl, suggestMerchantDomain } from '../lib/merchantIcons'

/**
 * Icône de marchand : favicon du site officiel quand le marchand est reconnu
 * dans le libellé (dictionnaire), sinon domaine deviné (« marque.fr » puis
 * « marque.com ») ; le service favicon répond 404 pour un domaine inconnu, ce
 * qui déclenche l'essai suivant puis le repli emoji. Le verdict par libellé
 * est mémorisé (session + localStorage) pour ne pas réinterroger.
 */

const CACHE_KEY = 'plan-financier-merchant-domains-v1'
const memory = new Map<string, string | null>()

const readCache = (): Record<string, string | null> => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string | null>) : {}
  } catch {
    return {}
  }
}

const remember = (label: string, domain: string | null) => {
  memory.set(label, domain)
  try {
    const cache = readCache()
    cache[label] = domain
    const entries = Object.entries(cache)
    // Borne : on garde les 400 libellés les plus récents.
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries.slice(-400))))
  } catch {
    /* stockage indisponible */
  }
}

const cached = (label: string): string | null | undefined => {
  if (memory.has(label)) return memory.get(label)
  const cache = readCache()
  if (label in cache) {
    memory.set(label, cache[label])
    return cache[label]
  }
  return undefined
}

/** Liste des domaines à essayer pour un libellé (dictionnaire d'abord). */
const candidatesFor = (label: string): string[] => {
  const known = suggestMerchantDomain(label)
  return known ? [known] : guessMerchantDomains(label)
}

export function MerchantLogo({
  label,
  icon,
  fallbackIcon,
  className = 'tx-merchant-icon',
}: {
  label: string
  /** Emoji posé sur l'opération (utilisateur ou IA) : prime sur un domaine deviné, pas sur le dictionnaire. */
  icon?: string | null
  fallbackIcon?: string | null
  className?: string
}) {
  const key = label.trim().toLowerCase()
  const [tracked, setTracked] = useState(key)
  const [attempt, setAttempt] = useState(0)
  const [resolved, setResolved] = useState<string | null | undefined>(() => cached(key))

  // Libellé changé (ligne réutilisée) : on repart du cache, pendant le rendu
  // (motif React « adjusting state on prop change », sans effet).
  if (tracked !== key) {
    setTracked(key)
    setAttempt(0)
    setResolved(cached(key))
  }

  const known = suggestMerchantDomain(label)
  const candidates = known ? [known] : icon ? [] : candidatesFor(label)
  const domain = resolved !== undefined ? resolved : candidates[attempt] ?? null

  /** Candidat suivant, ou repli emoji définitif pour ce libellé. */
  const advance = () => {
    if (resolved !== undefined) {
      // Domaine mémorisé devenu injoignable (hors-ligne) : emoji sans oublier le verdict.
      setResolved(null)
      return
    }
    if (attempt + 1 < candidates.length) setAttempt(attempt + 1)
    else {
      remember(key, null)
      setResolved(null)
    }
  }

  if (domain) {
    return (
      <img
        src={merchantFaviconUrl(domain)}
        alt=""
        aria-hidden="true"
        className={`${className} merchant-logo`}
        onLoad={(event) => {
          // Domaine inconnu : le service répond 404 avec une image générique
          // de 16 px (le navigateur déclenche quand même `load`). Un vrai
          // favicon revient en 64 px : en dessous de 32, on passe au suivant.
          if (event.currentTarget.naturalWidth < 32) {
            advance()
            return
          }
          if (resolved === undefined) {
            remember(key, domain)
            setResolved(domain)
          }
        }}
        onError={advance}
      />
    )
  }

  const emoji = icon ?? fallbackIcon
  if (emoji) {
    return (
      <span className={className} aria-hidden="true">
        {emoji}
      </span>
    )
  }

  return null
}
