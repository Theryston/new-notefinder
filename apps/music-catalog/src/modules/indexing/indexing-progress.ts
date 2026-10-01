/**
 * How far indexing got, as a whole percent (0 to 100). An empty catalog
 * counts as fully indexed, so a zero total never divides by zero.
 */
export const indexingPercent = (indexed: number, total: number): number => {
  if (total <= 0) {
    return 100;
  }
  const percent = Math.round((indexed / total) * 100);
  return Math.min(100, Math.max(0, percent));
};
