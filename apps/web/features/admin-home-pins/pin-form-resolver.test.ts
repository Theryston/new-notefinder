import type { ResolverOptions } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { PinFormValues } from './pin-form';
import { emptyPinForm } from './pin-form';
import { pinFormResolver } from './pin-form-resolver';

const options: ResolverOptions<PinFormValues> = {
  fields: {},
  shouldUseNativeValidation: false,
};

const validValues = (): PinFormValues => ({
  ...emptyPinForm(),
  kind: 'row',
  layout: 'standard',
  trackIdsText: 'trk_a\ntrk_b',
  position: 2,
  priority: 0,
  audience: 'everyone',
  locale: '',
  startsAt: '',
  endsAt: '',
  titleEn: 'Summer picks',
  titlePt: 'Escolhas de verão',
  sponsored: false,
});

describe('pinFormResolver', () => {
  it('accepts a valid row pin', async () => {
    const values = validValues();
    await expect(pinFormResolver(values, undefined, options)).resolves.toEqual({
      values,
      errors: {},
    });
  });

  it('requires Tracks and every title of an all-locales pin', async () => {
    const result = await pinFormResolver(
      { ...validValues(), trackIdsText: '  \n ', titleEn: '', titlePt: '' },
      undefined,
      options,
    );
    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      trackIdsText: { type: 'too_small' },
      titleEn: { type: 'custom' },
      titlePt: { type: 'custom' },
    });
  });

  it('asks only the pin locale for its title', async () => {
    const valid = await pinFormResolver(
      { ...validValues(), locale: 'pt-BR', titleEn: '' },
      undefined,
      options,
    );
    expect(valid.errors).toEqual({});

    const missing = await pinFormResolver(
      { ...validValues(), locale: 'pt-BR', titlePt: '' },
      undefined,
      options,
    );
    expect(missing.errors).toMatchObject({ titlePt: { type: 'custom' } });
    expect(missing.errors).not.toHaveProperty('titleEn');
  });

  it('refuses a window that ends before it starts', async () => {
    const result = await pinFormResolver(
      {
        ...validValues(),
        startsAt: '2026-11-02T10:00',
        endsAt: '2026-11-01T10:00',
      },
      undefined,
      options,
    );
    expect(result.errors).toMatchObject({ endsAt: { type: 'custom' } });
  });

  it('refuses duplicate Tracks', async () => {
    const result = await pinFormResolver(
      { ...validValues(), trackIdsText: 'trk_a\ntrk_a' },
      undefined,
      options,
    );
    expect(result.errors).toMatchObject({ trackIdsText: { type: 'custom' } });
  });

  it('keeps the kind and the layout in agreement', async () => {
    const hero = await pinFormResolver(
      { ...validValues(), kind: 'hero', layout: 'standard', position: 0 },
      undefined,
      options,
    );
    expect(hero.errors).toMatchObject({ layout: { type: 'custom' } });

    const row = await pinFormResolver(
      { ...validValues(), kind: 'row', layout: 'hero' },
      undefined,
      options,
    );
    expect(row.errors).toMatchObject({ layout: { type: 'custom' } });
  });

  it('pins a hero to the hero slot', async () => {
    const result = await pinFormResolver(
      { ...validValues(), kind: 'hero', layout: 'hero', position: 2 },
      undefined,
      options,
    );
    expect(result.errors).toMatchObject({ position: { type: 'custom' } });
  });

  it('flags an unreadable schedule without the schema', async () => {
    const result = await pinFormResolver(
      { ...validValues(), startsAt: 'not-a-date' },
      undefined,
      options,
    );
    expect(result.errors).toMatchObject({ startsAt: { type: 'invalid_type' } });
  });
});
