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

export const categoryColors: Record<Category, string> = {
  Courses: '#f97316',
  Transport: '#14b8a6',
  Ecole: '#0ea5e9',
  Loisirs: '#f43f5e',
  Sante: '#a855f7',
  Maison: '#10b981',
  Autre: '#64748b',
}

export const envelopeColors: Record<Envelope, string> = {
  Perso: '#f97316',
  Maison: '#10b981',
  Vacances: '#eab308',
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
