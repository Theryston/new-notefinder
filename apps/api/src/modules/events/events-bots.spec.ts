import { describe, expect, it } from 'vitest';
import { isBotUserAgent } from './events-bots.js';

describe('isBotUserAgent', () => {
  it('keeps a real browser', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
    'curl/8.0 (compatible; AhrefsBot/7.0)',
    'Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)',
  ])('drops the crawler %s', (userAgent) => {
    expect(isBotUserAgent(userAgent)).toBe(true);
  });

  it('does not mistake a missing user agent for a bot', () => {
    expect(isBotUserAgent(undefined)).toBe(false);
  });
});
