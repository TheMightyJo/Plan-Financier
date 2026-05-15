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

export const inferEnvelope = (category: Category): Envelope => {
  if (category === 'Maison' || category === 'Courses') {
    return 'Maison'
  }

  if (category === 'Loisirs' || category === 'Autre') {
    return 'Vacances'
  }

  return 'Perso'
}
