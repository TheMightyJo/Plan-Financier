const COMBINING_DIACRITICS = /[̀-ͯ]/g

export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const getLabelTokens = (value: string): string[] =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2)

export const computeLabelSimilarity = (left: string, right: string): number => {
  const leftTokens = getLabelTokens(left)
  const rightTokens = getLabelTokens(right)

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0
  }

  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length
  const union = new Set([...leftSet, ...rightSet]).size

  return union === 0 ? 0 : intersection / union
}

export const sanitizeProfileId = (value: string): string =>
  normalizeText(value).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
