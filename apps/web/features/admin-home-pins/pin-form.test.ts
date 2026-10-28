import type { EditorialPin } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

import {
  emptyPinForm,
  formValuesToBody,
  fromInputDateTime,
  parseTrackIds,
  pinFormErrorKey,
  pinFormFieldForPath,
  pinToFormValues,
  servedLocales,
  toInputDateTime,
} from './pin-form';

describe('parseTrackIds', () => {
  it('reads one Track per line, trimmed and in order', () => {
    expect(parseTrackIds('  trk_a\ntrk_b \n\ntrk_c\n')).toEqual([
      'trk_a',
      'trk_b',
      'trk_c',
    ]);
  });

  it('also splits on commas and drops empties', () => {
    expect(parseTrackIds('trk_a, trk_b,\ntrk_c')).toEqual([
      'trk_a',
      'trk_b',
      'trk_c',
    ]);
  });

  it('reads an empty textarea as no Tracks', () => {
    expect(parseTrackIds('  \n ')).toEqual([]);
  });
});

describe('schedule inputs', () => {
  it('round-trips an instant through the local input', () => {
    const iso = '2026-10-21T12:00:00.000Z';
    const roundTripped = fromInputDateTime(toInputDateTime(iso));
    expect(roundTripped).not.toBeNull();
    expect(new Date(roundTripped ?? '').getTime()).toBe(
      Math.floor(new Date(iso).getTime() / 60_000) * 60_000,
    );
  });

  it('reads the input shape', () => {
    expect(toInputDateTime('2026-10-21T12:00:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    );
  });

  it('reads an empty schedule as open-ended', () => {
    expect(fromInputDateTime('')).toBeNull();
  });
});

describe('servedLocales', () => {
  it('asks every locale for a pin without one', () => {
    expect(servedLocales(['en', 'pt-BR'], '')).toEqual(['en', 'pt-BR']);
  });

  it('asks only the pin locale otherwise', () => {
    expect(servedLocales(['en', 'pt-BR'], 'pt-BR')).toEqual(['pt-BR']);
  });
});

const pin = (overrides: Partial<EditorialPin> = {}): EditorialPin => ({
  id: 'pin_1',
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds: ['trk_a', 'trk_b'] },
  position: 2,
  priority: 10,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Summer picks', 'pt-BR': 'Escolhas de verão' },
  sponsored: false,
  createdBy: null,
  updatedBy: null,
  createdAt: '2026-10-21T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
  ...overrides,
});

describe('pinToFormValues', () => {
  it('fills every field from the pin', () => {
    expect(pinToFormValues(pin())).toMatchObject({
      kind: 'row',
      layout: 'standard',
      trackIdsText: 'trk_a\ntrk_b',
      position: 2,
      priority: 10,
      audience: 'everyone',
      locale: '',
      titleEn: 'Summer picks',
      titlePt: 'Escolhas de verão',
      sponsored: false,
    });
  });

  it('keeps the pin locale and schedule', () => {
    const values = pinToFormValues(
      pin({
        locale: 'pt-BR',
        startsAt: '2026-10-22T12:00:00.000Z',
        endsAt: '2026-10-29T12:00:00.000Z',
      }),
    );
    expect(values.locale).toBe('pt-BR');
    expect(values.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(values.endsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('formValuesToBody', () => {
  it('maps an all-locales hero to the endpoint body', () => {
    const body = formValuesToBody({
      ...emptyPinForm(),
      kind: 'hero',
      layout: 'hero',
      position: 0,
      trackIdsText: 'trk_a',
      titleEn: ' Featured ',
      titlePt: 'Destaque',
      sponsored: true,
    });
    expect(body).toEqual({
      kind: 'hero',
      layout: 'hero',
      source: { type: 'tracks', trackIds: ['trk_a'] },
      position: 0,
      priority: 0,
      audience: 'everyone',
      locale: null,
      startsAt: null,
      endsAt: null,
      titles: { en: 'Featured', 'pt-BR': 'Destaque' },
      sponsored: true,
    });
  });

  it('leaves empty titles and schedule out', () => {
    const body = formValuesToBody({
      ...emptyPinForm(),
      trackIdsText: 'trk_a',
      titleEn: 'Only English',
      titlePt: '   ',
    });
    expect(body.titles).toEqual({ en: 'Only English' });
    expect(body.startsAt).toBeNull();
    expect(body.endsAt).toBeNull();
  });
});

describe('pinFormFieldForPath', () => {
  it.each([
    [['titles', 'en'], 'titleEn'],
    [['titles', 'pt-BR'], 'titlePt'],
    [['source', 'trackIds'], 'trackIdsText'],
    [['source'], 'trackIdsText'],
    [['endsAt'], 'endsAt'],
    [['position'], 'position'],
  ])('maps %j to %s', (path, field) => {
    expect(pinFormFieldForPath(path)).toBe(field);
  });

  it('ignores unknown paths', () => {
    expect(pinFormFieldForPath([])).toBeNull();
    expect(pinFormFieldForPath(['unknown'])).toBeNull();
  });
});

describe('pinFormErrorKey', () => {
  it.each([
    ['titleEn', 'too_small', 'errors.required'],
    ['titlePt', 'custom', 'errors.required'],
    ['titleEn', 'too_big', 'errors.tooLong'],
    ['trackIdsText', 'too_small', 'errors.required'],
    ['trackIdsText', 'too_big', 'errors.tooMany'],
    ['trackIdsText', 'custom', 'errors.duplicateTracks'],
    ['layout', 'custom', 'errors.kindLayoutMismatch'],
    ['position', 'custom', 'errors.heroPositionFixed'],
    ['position', 'too_big', 'errors.outOfRange'],
    ['priority', 'too_small', 'errors.outOfRange'],
    ['endsAt', 'custom', 'errors.endsBeforeStart'],
    ['kind', 'invalid_type', 'errors.invalid'],
    ['audience', 'whatever', 'errors.invalid'],
  ])('%s with %s reads %s', (field, type, key) => {
    expect(
      pinFormErrorKey(
        field as Parameters<typeof pinFormErrorKey>[0],
        type === 'whatever' ? 'something-else' : type,
      ),
    ).toBe(key);
  });
});
