import { Figtree, Geist_Mono } from 'next/font/google';

import { cn } from '@/lib/utils';

// `optional`: the fonts are preloaded, so they are almost always there for
// the first paint; when they aren't, the page keeps the fallback instead of
// swapping later. A swap reflows text, and on centered layouts (auth pages)
// that moves everything and eats the CLS budget (lighthouserc.cjs). The
// fallback is metric-adjusted to Arial, which not every system has.
const fontSans = Figtree({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'optional',
});

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'optional',
});

/** The `<html>` class names every document needs (locale and framework 404). */
export const documentClassName = cn(
  'antialiased',
  fontSans.variable,
  fontMono.variable,
  'font-sans',
);
