import { useState } from 'react'
import { merchantFaviconUrl, suggestMerchantDomain } from '../lib/merchantIcons'

/**
 * Icône de marchand : favicon du site officiel quand le marchand est reconnu
 * dans le libellé (usage nominatif — pratique standard des apps de budget),
 * sinon repli sur l'emoji fourni. Si l'image ne charge pas (hors-ligne,
 * domaine mort), repli emoji aussi.
 */
export function MerchantLogo({
  label,
  fallbackIcon,
  className = 'tx-merchant-icon',
}: {
  label: string
  fallbackIcon?: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const domain = suggestMerchantDomain(label)

  if (domain && !failed) {
    return (
      <img
        src={merchantFaviconUrl(domain)}
        alt=""
        aria-hidden="true"
        className={`${className} merchant-logo`}
        onError={() => setFailed(true)}
      />
    )
  }

  if (fallbackIcon) {
    return (
      <span className={className} aria-hidden="true">
        {fallbackIcon}
      </span>
    )
  }

  return null
}
