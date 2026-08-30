import type { Category, Envelope } from '../types'
import { normalizeText } from './text'

export const categories: Category[] = [
  'Courses',
  'Transport',
  'Ecole',
  'Loisirs',
  'Sante',
  'Maison',
  'Autre',
]

export const envelopes: Envelope[] = ['Perso', 'Maison', 'Vacances']

// ── Grand catalogue (modale d'opération) ────────────────────────────────────
// Les 7 catégories historiques ci-dessus restent les « principales »
// (objectifs, graphiques) ; le catalogue ci-dessous propose un choix riche,
// groupé et cherchable. Les libellés historiques y figurent tels quels pour
// que les anciennes données restent classées.

export type CategoryGroup = { label: string; options: string[] }

export const EXPENSE_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'Vie quotidienne',
    options: ['Courses', 'Restaurants & cafés', 'Vêtements', 'Beauté & soins', 'Tabac & divers'],
  },
  {
    label: 'Logement',
    options: [
      'Maison',
      'Loyer / Crédit immobilier',
      'Électricité & gaz',
      'Eau',
      'Internet & téléphone',
      'Assurance habitation',
      'Meubles & équipement',
      'Travaux & jardin',
    ],
  },
  {
    label: 'Transport',
    options: ['Transport', 'Carburant', 'Entretien voiture', 'Assurance auto', 'Péage & parking', 'Train & avion'],
  },
  {
    label: 'Enfants & école',
    options: ['Ecole', 'Cantine', "Garde d'enfants", 'Activités des enfants', 'Vêtements enfants'],
  },
  {
    label: 'Santé',
    options: ['Sante', 'Médecin & pharmacie', 'Mutuelle', 'Optique & dentaire'],
  },
  {
    label: 'Loisirs & culture',
    options: [
      'Loisirs',
      'Abonnements & streaming',
      'Sport',
      'Vacances & voyages',
      'Sorties',
      'Livres & jeux',
      'Animaux',
    ],
  },
  {
    label: 'Finances & obligations',
    options: [
      'Impôts & taxes',
      'Frais bancaires',
      'Assurances',
      'Remboursement de crédit',
      'Épargne & investissement',
      'Dons & cadeaux',
    ],
  },
  { label: 'Divers', options: ['Autre'] },
]

export const INCOME_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'Revenus du travail',
    options: ['Salaire', 'Prime & bonus', 'Freelance & missions', 'Heures supplémentaires'],
  },
  {
    label: 'Aides & pensions',
    options: ['Aides & allocations', 'Pension & retraite', 'Pension alimentaire', "Bourse d'études"],
  },
  {
    label: 'Argent reçu',
    options: ['Remboursement', 'Cadeau reçu', "Vente d'occasion"],
  },
  {
    label: 'Placements',
    options: ['Intérêts & dividendes', 'Revenus locatifs'],
  },
  { label: 'Divers', options: ['Autre'] },
]

export const ENVELOPE_GROUPS: CategoryGroup[] = [
  { label: 'Quotidien', options: ['Perso', 'Maison', 'Courant'] },
  { label: 'Projets', options: ['Vacances', 'Projets', 'Travaux'] },
  { label: 'Famille', options: ['Enfants', 'Animaux'] },
  { label: 'Prévoyance', options: ['Épargne', 'Imprévus', 'Santé'] },
  { label: 'Mobilité', options: ['Véhicule'] },
  { label: 'Occasions', options: ['Cadeaux', 'Fêtes'] },
]

export const allExpenseCategories: string[] = EXPENSE_CATEGORY_GROUPS.flatMap((group) => group.options)
export const allIncomeCategories: string[] = INCOME_CATEGORY_GROUPS.flatMap((group) => group.options)

// Palette charte pour colorer déterministiquement les catégories hors des
// 7 principales (points colorés, camemberts).
const FALLBACK_CATEGORY_PALETTE = [
  '#C05C2A', '#8B6C52', '#B8963E', '#6B5B8A', '#A08060', '#3A7D44', '#7D5BA6', '#5B8A72',
]

export const colorForCategory = (category: Category): string => {
  const known = categoryColors[category]
  if (known) return known
  let hash = 0
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0
  return FALLBACK_CATEGORY_PALETTE[Math.abs(hash) % FALLBACK_CATEGORY_PALETTE.length]
}

// Couleurs catégories alignées sur la charte Plan Financier
// (cf. src/styles/tokens.css et brand_identity_plan_financier.html).
export const categoryColors: Record<Category, string> = {
  Courses: '#C05C2A',   // terracotta
  Transport: '#8B6C52', // terre chaude
  Ecole: '#B8963E',     // ambre doré
  Loisirs: '#6B5B8A',   // prune doux
  Sante: '#A08060',     // caramel
  Maison: '#3A7D44',    // vert forêt
  Autre: '#D6C5B0',     // lin
}

export const envelopeColors: Record<Envelope, string> = {
  Perso: '#8B6C52',     // terre (primaire)
  Maison: '#3A7D44',    // vert
  Vacances: '#6B5B8A',  // prune
}

export const categoryKeywords: Array<{ category: Category; keywords: string[] }> = [
  { category: 'Courses', keywords: ['supermarche', 'courses', 'alimentation', 'carrefour'] },
  { category: 'Transport', keywords: ['transport', 'metro', 'bus', 'essence', 'train'] },
  { category: 'Ecole', keywords: ['ecole', 'cantine', 'fourniture', 'scolaire', 'cours'] },
  { category: 'Loisirs', keywords: ['cinema', 'loisir', 'sport', 'sortie', 'jeu'] },
  { category: 'Sante', keywords: ['pharmacie', 'medecin', 'sante', 'dentiste'] },
  { category: 'Maison', keywords: ['electricite', 'loyer', 'maison', 'internet', 'eau'] },
]

export const suggestCategoryFromLabel = (label: string): Category | null => {
  const normalized = normalizeText(label)
  if (!normalized.trim()) {
    return null
  }

  const found = categoryKeywords.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  )

  return found?.category ?? null
}

const ENVELOPE_BY_GROUP: Record<string, Envelope> = {
  'Logement': 'Maison',
  'Vie quotidienne': 'Maison',
  'Enfants & école': 'Enfants',
  'Loisirs & culture': 'Vacances',
}

const ENVELOPE_BY_CATEGORY: Record<string, Envelope> = {
  'Épargne & investissement': 'Épargne',
  'Entretien voiture': 'Véhicule',
  'Carburant': 'Véhicule',
  'Assurance auto': 'Véhicule',
  'Dons & cadeaux': 'Cadeaux',
  'Animaux': 'Animaux',
}

export const inferEnvelope = (category: Category): Envelope => {
  if (category === 'Maison' || category === 'Courses') {
    return 'Maison'
  }

  if (category === 'Loisirs' || category === 'Autre') {
    return 'Vacances'
  }

  if (ENVELOPE_BY_CATEGORY[category]) {
    return ENVELOPE_BY_CATEGORY[category]
  }

  const group = EXPENSE_CATEGORY_GROUPS.find((entry) => entry.options.includes(category))
  if (group && ENVELOPE_BY_GROUP[group.label]) {
    return ENVELOPE_BY_GROUP[group.label]
  }

  return 'Perso'
}

// Emoji représentatif d'une catégorie (repli d'icône quand aucun marchand
// n'est reconnu sur la ligne).
const CATEGORY_EMOJI: Record<string, string> = {
  Courses: '🛒',
  Transport: '🚗',
  Ecole: '🎒',
  Loisirs: '🎭',
  Sante: '💊',
  Maison: '🏠',
  Autre: '💳',
}

const GROUP_EMOJI: Record<string, string> = {
  'Vie quotidienne': '🛒',
  'Logement': '🏠',
  'Transport': '🚗',
  'Enfants & école': '🎒',
  'Santé': '💊',
  'Loisirs & culture': '🎭',
  'Finances & obligations': '🏛️',
  'Revenus du travail': '💼',
  'Aides & pensions': '🏛️',
  'Argent reçu': '🎁',
  'Placements': '📈',
}

export const categoryEmoji = (category: Category): string => {
  if (CATEGORY_EMOJI[category]) return CATEGORY_EMOJI[category]
  const group =
    EXPENSE_CATEGORY_GROUPS.find((entry) => entry.options.includes(category)) ??
    INCOME_CATEGORY_GROUPS.find((entry) => entry.options.includes(category))
  return (group && GROUP_EMOJI[group.label]) || '💳'
}
