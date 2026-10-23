import { describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_TOUCHES_KEY,
  captureCampaignTouch,
  readCampaignTouches,
} from './campaign-touches';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    value: (key: string) => values.get(key),
  };
};

describe('campaign touches', () => {
  it('preserves the first touch and replaces the last touch', () => {
    const browser = storage();
    const first = captureCampaignTouch(
      browser,
      'https://site.test/?utm_source=first&utm_campaign=launch',
      'https://search.test/',
    );
    const later = captureCampaignTouch(
      browser,
      'https://site.test/tracks/a?fbclid=second&ignored=secret',
      'https://social.test/',
    );

    expect(first.firstTouch?.utmSource).toBe('first');
    expect(later.firstTouch).toEqual(first.firstTouch);
    expect(later.lastTouch).toEqual({
      fbclid: 'second',
      referrer: 'https://social.test/',
      landingPath: '/tracks/a',
    });
    expect(browser.value(CAMPAIGN_TOUCHES_KEY)).not.toContain('secret');
  });

  it('ignores arrivals without campaign parameters', () => {
    const browser = storage();
    captureCampaignTouch(browser, 'https://site.test/?utm_source=first', '');

    expect(
      captureCampaignTouch(browser, 'https://site.test/?q=song', '').lastTouch
        ?.utmSource,
    ).toBe('first');
    expect(browser.setItem).toHaveBeenCalledTimes(1);
  });

  it('filters values not in the allowlist when reading local storage', () => {
    const browser = storage();
    browser.setItem(
      CAMPAIGN_TOUCHES_KEY,
      JSON.stringify({
        firstTouch: { utmSource: 'known', email: 'private@example.test' },
        lastTouch: { gclid: 'click', arbitrary: 'secret' },
      }),
    );

    expect(readCampaignTouches(browser)).toEqual({
      firstTouch: { utmSource: 'known' },
      lastTouch: { gclid: 'click' },
    });
  });
});
