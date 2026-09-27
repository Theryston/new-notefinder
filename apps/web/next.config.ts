import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin({
  requestConfig: './lib/i18n/request.ts',
});

// Static pages bake absolute canonical/hreflang URLs in at build time.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_SITE_URL === undefined
) {
  console.warn(
    'NEXT_PUBLIC_SITE_URL is not set: canonical and hreflang URLs will point ' +
      'at http://localhost:3000. Set it when building production images.',
  );
}

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default withNextIntl(nextConfig);
