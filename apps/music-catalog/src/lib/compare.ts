/** Orders text by code unit: the same on every machine, unlike localeCompare. */
export const compareText = (a: string, b: string): number =>
  Number(a > b) - Number(a < b);

/** Like {@link compareText}, with the values that are null after the rest. */
export const compareTextNullsLast = (
  a: string | null,
  b: string | null,
): number => {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null);
  }
  return compareText(a, b);
};
