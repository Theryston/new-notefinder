import type { ReactNode } from 'react';

// The address the legacy terms already gave for questions, so the text stays
// the same for people who read the old version.
const ISSUES_URL = 'https://github.com/Theryston/notefinder/issues';

/**
 * Values for `t.rich()` in the terms: `<strong>` for the emphasized phrases
 * and `<link>` (plus its visible `{url}`) for the contact address, which
 * lives here so the translations don't carry it.
 */
export const termsRichText = {
  url: ISSUES_URL,
  strong: (chunks: ReactNode) => (
    <strong className="font-semibold">{chunks}</strong>
  ),
  // The brand color sits on the underline, not the text: `text-primary` on
  // the page is 3.5:1, below the 4.5:1 that body-size text needs (DESIGN.md).
  link: (chunks: ReactNode) => (
    <a
      href={ISSUES_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words rounded-full font-semibold text-foreground underline decoration-2 decoration-primary underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {chunks}
    </a>
  ),
};
