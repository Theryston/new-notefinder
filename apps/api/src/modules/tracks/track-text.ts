// Text helpers shared by the matching rules and the ordering of the pipeline
// (pure). Kept in one place so the two sides of a comparison agree.

/** Accents taken off the letters (NFKD, then the combining marks dropped). */
export const foldAccents = (text: string): string =>
  text.normalize('NFKD').replace(/\p{M}/gu, '');

/** Code point order, the order the Music catalog uses for its ties. */
export const compareText = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};
