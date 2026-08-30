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
