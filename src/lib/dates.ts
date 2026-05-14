export const getDateDistanceInDays = (left: string, right: string): number => {
  const leftDate = new Date(left)
  const rightDate = new Date(right)
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24)
}
