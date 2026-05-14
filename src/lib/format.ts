export const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export const formatTooltipValue = (
  value: number | string | ReadonlyArray<number | string> | undefined,
): string => {
  const rawValue = Array.isArray(value) ? value[0] : value
  const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)

  return euroFormatter.format(numericValue)
}
