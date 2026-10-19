import { describe, expect, it, vi } from 'vitest';

import { loadProfileOgFonts } from './profile-og-fonts';

vi.mock('server-only', () => ({}));

describe('loadProfileOgFonts', () => {
  it('loads the Figtree weights the card uses, bold included', async () => {
    const fonts = await loadProfileOgFonts();

    expect(fonts.map((font) => font.weight)).toEqual([600, 700, 800]);
    for (const font of fonts) {
      expect(font.name).toBe('Figtree');
      expect(font.data.byteLength).toBeGreaterThan(0);
    }
  });
});
