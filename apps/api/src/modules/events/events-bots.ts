/**
 * User agents that never carry a real visit: crawlers, preview fetchers and
 * uptime probes. Their batches are dropped after the 202, so they neither
 * pollute the events table nor learn they were ignored.
 */
const BOT_TOKENS = [
  'bot',
  'crawl',
  'spider',
  'slurp',
  'mediapartners',
  'baidu',
  'yandex',
  'sogou',
  'exabot',
  'facebot',
  'externalhit',
  'ia_archiver',
  'ahrefs',
  'semrush',
  'mj12bot',
  'dotbot',
  'petalbot',
  'phantomjs',
  'selenium',
];

const botPattern = new RegExp(BOT_TOKENS.join('|'), 'i');

/**
 * Whether the request came from a bot. A missing user agent is not one: real
 * browsers always send it, and the e2e suite posts without one.
 */
export const isBotUserAgent = (userAgent: string | undefined): boolean =>
  userAgent !== undefined && botPattern.test(userAgent);
