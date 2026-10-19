import { beforeEach, describe, expect, it, vi } from 'vitest';

import { profileChipCopy } from './profile-chip-copy';

const { getTranslations } = vi.hoisted(() => ({
  getTranslations: vi.fn<(options: unknown) => Promise<unknown>>(),
}));

vi.mock('next-intl/server', () => ({ getTranslations }));

/** A translator that names its prefix, the key and the values it was given. */
function fakeTranslator(prefix: string) {
  return vi.fn((key: string, values?: Record<string, unknown>) =>
    values === undefined
      ? `${prefix}:${key}`
      : `${prefix}:${key}:${JSON.stringify(values)}`,
  );
}

function namespaceOf(options: unknown): string {
  if (typeof options === 'string') return options;
  return typeof options === 'object' &&
    options !== null &&
    'namespace' in options &&
    typeof options.namespace === 'string'
    ? options.namespace
    : '';
}

describe('profileChipCopy', () => {
  beforeEach(() => {
    getTranslations.mockReset();
    getTranslations.mockImplementation(async (options) =>
      fakeTranslator(namespaceOf(options)),
    );
  });

  it('reads the copy for the request locale when none is given', async () => {
    const copy = await profileChipCopy();

    expect(getTranslations).toHaveBeenCalledWith('publicProfile.chips');
    expect(getTranslations).toHaveBeenCalledWith('profile.edit.dailyTarget');
    expect(copy.highlightsLabel).toBe('publicProfile.chips:label');
  });

  it('reads the copy for an explicit locale, for the preview image', async () => {
    getTranslations.mockImplementation(async () => fakeTranslator('pt'));

    const copy = await profileChipCopy('pt-BR');

    expect(getTranslations).toHaveBeenCalledWith({
      locale: 'pt-BR',
      namespace: 'publicProfile.chips',
    });
    expect(copy.messages.label('vocalRange')).toBe('pt:vocalRange');
    expect(copy.messages.dailyTargetValue(15)).toBe(
      'pt:minutes:{"minutes":15}',
    );
    expect(copy.messages.vocalRangeValue('C3', 'D5')).toBe(
      'pt:vocalRangeValue:{"lowest":"C3","highest":"D5"}',
    );
  });
});
