// Icônes de marchands : des EMOJI (libres de droit par nature) — jamais de
// logos de marques, qui sont des marques déposées et exposeraient l'app à des
// problèmes juridiques. Dictionnaire local instantané ; l'IA complète pour
// les libellés inconnus quand elle est configurée.
import { normalizeText } from './text'

const MERCHANT_ICONS: Array<[string[], string]> = [
  [['carrefour', 'leclerc', 'lidl', 'auchan', 'intermarche', 'monoprix', 'casino', 'aldi', 'supermarche', 'super u', 'courses', 'marche'], '🛒'],
  [['boulangerie', 'boulanger patissier', 'patisserie'], '🥖'],
  [['netflix', 'disney', 'canal', 'cinema', 'cine'], '🎬'],
  [['spotify', 'deezer', 'musique'], '🎵'],
  [['apple', 'iphone', 'ipad', 'samsung', 'fnac', 'darty', 'boulanger.com'], '📱'],
  [['amazon', 'cdiscount', 'colis', 'la poste', 'chronopost', 'mondial relay'], '📦'],
  [['sncf', 'ratp', 'navigo', 'tgv', 'ouigo', 'train', 'metro', 'tram'], '🚆'],
  [['uber', 'taxi', 'blablacar', 'bolt'], '🚕'],
  [['essence', 'total', 'esso', 'shell', 'bp ', 'carburant', 'station'], '⛽'],
  [['parking', 'peage', 'autoroute', 'vinci'], '🅿️'],
  [['edf', 'engie', 'electricite', 'totalenergies'], '⚡'],
  [['veolia', 'suez', 'eau '], '💧'],
  [['orange', 'sfr', 'bouygues telecom', 'free mobile', 'freebox', 'internet', 'mobile'], '📶'],
  [['mcdo', 'mcdonald', 'burger king', 'kfc', 'quick', 'kebab', 'pizza', 'sushi', 'restaurant', 'resto', 'brasserie', 'cafe ', 'bistrot'], '🍽️'],
  [['pharmacie', 'medecin', 'docteur', 'dentiste', 'mutuelle', 'hopital'], '💊'],
  [['loyer', 'agence immo', 'syndic'], '🏠'],
  [['assurance', 'maif', 'macif', 'axa', 'matmut', 'gmf'], '🛡️'],
  [['salle de sport', 'basic fit', 'fitness', 'piscine', 'club '], '🏋️'],
  [['ecole', 'cantine', 'creche', 'garderie', 'etudes'], '🎒'],
  [['vetement', 'zara', 'kiabi', 'decathlon', 'h&m', 'hm '], '👕'],
  [['coiffeur', 'barbier', 'institut'], '💇'],
  [['salaire', 'paie', 'virement employeur'], '💼'],
  [['caf ', 'allocations', 'impots', 'dgfip', 'urssaf'], '🏛️'],
  [['banque', 'frais bancaires', 'agios'], '🏦'],
  [['cadeau', 'anniversaire', 'noel'], '🎁'],
  [['vacances', 'hotel', 'airbnb', 'booking', 'camping', 'vol ', 'avion'], '🏖️'],
]

/** Emoji du marchand déduit du libellé, ou null si inconnu. */
export const suggestMerchantIcon = (label: string): string | null => {
  const normalized = ` ${normalizeText(label)} `
  for (const [keywords, icon] of MERCHANT_ICONS) {
    if (keywords.some((keyword) => normalized.includes(keyword.trim()) )) {
      return icon
    }
  }
  return null
}

/** Valide un emoji d'icône (1 à 4 unités de code, pas de texte). */
export const isValidTxIcon = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 8 && !/[a-z0-9]/i.test(value)

// ── Logos officiels (favicons) ──────────────────────────────────────────────
// Usage « nominatif » : le favicon du site officiel identifie le marchand
// d'une dépense (pratique standard des apps de budget). Jamais de logo
// embarqué dans l'app — l'icône est servie par le service favicon de Google.
// Repli : emoji suggestMerchantIcon si le marchand n'est pas reconnu ou si
// l'image ne charge pas.

const MERCHANT_DOMAINS: Array<[keywords: string[], domain: string]> = [
  [['canal plus', 'canalplus', 'mycanal', ' canal '], 'canalplus.com'],
  [['netflix'], 'netflix.com'],
  [['spotify'], 'spotify.com'],
  [['deezer'], 'deezer.com'],
  [['disney'], 'disneyplus.com'],
  [['prime video', 'amazon prime'], 'primevideo.com'],
  [['amazon'], 'amazon.fr'],
  [[' apple ', 'itunes', 'icloud'], 'apple.com'],
  [['google', 'youtube'], 'google.com'],
  [['carrefour'], 'carrefour.fr'],
  [['leclerc'], 'e.leclerc'],
  [['auchan'], 'auchan.fr'],
  [['lidl'], 'lidl.fr'],
  [['intermarche'], 'intermarche.com'],
  [['monoprix'], 'monoprix.fr'],
  [['picard'], 'picard.fr'],
  [['hellofresh', 'hello fresh'], 'hellofresh.fr'],
  [['uber eats', 'ubereats'], 'ubereats.com'],
  [[' uber '], 'uber.com'],
  [['deliveroo'], 'deliveroo.fr'],
  [['mcdo', 'mcdonald'], 'mcdonalds.fr'],
  [['burger king'], 'burgerking.fr'],
  [['sncf', 'ouigo', 'tgv'], 'sncf-connect.com'],
  [['ratp', 'navigo'], 'ratp.fr'],
  [['blablacar'], 'blablacar.fr'],
  [[' edf '], 'edf.fr'],
  [['engie'], 'engie.fr'],
  [['totalenergies', 'total energies'], 'totalenergies.fr'],
  [['veolia'], 'veolia.fr'],
  [[' orange '], 'orange.fr'],
  [['sfr'], 'sfr.fr'],
  [['bouygues'], 'bouyguestelecom.fr'],
  [['free mobile', 'freebox', 'free '], 'free.fr'],
  [['ikea'], 'ikea.com'],
  [['leroy merlin'], 'leroymerlin.fr'],
  [['castorama'], 'castorama.fr'],
  [['decathlon'], 'decathlon.fr'],
  [['fnac'], 'fnac.com'],
  [['darty'], 'darty.com'],
  [[' boulanger '], 'boulanger.com'],
  [['zara'], 'zara.com'],
  [['kiabi'], 'kiabi.com'],
  [['h&m', 'hm '], 'hm.com'],
  [['sephora'], 'sephora.fr'],
  [['basic fit', 'basic-fit'], 'basic-fit.com'],
  [['airbnb'], 'airbnb.fr'],
  [['booking'], 'booking.com'],
  [['maif'], 'maif.fr'],
  [['macif'], 'macif.fr'],
  [[' axa '], 'axa.fr'],
  [['matmut'], 'matmut.fr'],
  [['caf ', 'allocations familiales'], 'caf.fr'],
  [['impots', 'dgfip'], 'impots.gouv.fr'],
  [['la poste'], 'laposte.fr'],
  [['doctolib'], 'doctolib.fr'],
  [['rakuten'], 'rakuten.com'],
  [['viki'], 'viki.com'],
  [['steam'], 'steampowered.com'],
  [['playstation'], 'playstation.com'],
  [['nintendo'], 'nintendo.fr'],
]

/** Domaine officiel du marchand déduit du libellé, ou null si inconnu. */
export const suggestMerchantDomain = (label: string): string | null => {
  const normalized = ` ${normalizeText(label)} `
  for (const [keywords, domain] of MERCHANT_DOMAINS) {
    // Pas de trim : un mot-clé avec espace final (« canal  ») exige bien
    // une fin de mot, pour éviter les faux positifs (« canalisation »).
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return domain
    }
  }
  return null
}

/** URL du favicon (64 px) servie par Google (hôte final gstatic, sans
 * redirection — la CSP img-src autorise https://*.gstatic.com). */
export const merchantFaviconUrl = (domain: string): string =>
  `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(domain)}&size=64`
