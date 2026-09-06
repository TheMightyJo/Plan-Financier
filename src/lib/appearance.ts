/** Apparence : préférences d'accessibilité et palettes d'accent (partagées App / Paramètres). */

export type A11yPrefs = {
  textSize: 'normal' | 'large' | 'xl'
  reduceMotion: boolean
  highContrast: boolean
}

export const COLOR_PALETTES = [
  { id: 'cafe', label: 'Café', dots: ['#C4956A', '#8B6C52'] },
  { id: 'foret', label: 'Forêt', dots: ['#8FBF7A', '#3A7D44'] },
  { id: 'ocean', label: 'Océan', dots: ['#7FB5D1', '#2E6E8E'] },
  { id: 'prune', label: 'Prune', dots: ['#A794C9', '#6B5B8A'] },
  { id: 'terracotta', label: 'Terracotta', dots: ['#D98B5F', '#C05C2A'] },
] as const
export type PaletteId = (typeof COLOR_PALETTES)[number]['id']
export const isPaletteId = (value: unknown): value is PaletteId =>
  COLOR_PALETTES.some((entry) => entry.id === value)
