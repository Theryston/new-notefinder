/** The body of a row pin of specific Tracks, as the admin API takes it. */
export const rowPinBody = (
  trackIds: string[],
  overrides: Record<string, unknown> = {},
) => ({
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds },
  position: 1,
  titles: { en: 'Festive', 'pt-BR': 'Festivo' },
  ...overrides,
});

/** The body of a hero pin on one Track, as the admin API takes it. */
export const heroPinBody = (
  trackId: string,
  overrides: Record<string, unknown> = {},
) => rowPinBody([trackId], { kind: 'hero', layout: 'hero', ...overrides });
