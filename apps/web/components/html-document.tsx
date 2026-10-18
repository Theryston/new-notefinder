import type { ReactNode } from 'react';

import { documentClassName } from '@/lib/fonts';
import type { Locale } from '@/lib/i18n/routing';

/**
 * The `<html>` and `<body>` every document shares: the locale on the root
 * element, and the font classes. The locale layout and the framework 404 both
 * render it, so the two cannot drift apart.
 */
export function HtmlDocument({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <html lang={locale} suppressHydrationWarning className={documentClassName}>
      <body>{children}</body>
    </html>
  );
}
