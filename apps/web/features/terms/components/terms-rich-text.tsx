import type { ReactNode } from 'react';

// The contact address and the source repository live here, not in the
// translations, so they can't drift apart between locales.
const CONTACT_EMAIL = 'hello@theryston.dev';
const REPOSITORY_URL = 'https://github.com/Theryston/vozzify';

// The brand color sits on the underline, not the text: `text-primary` on the
// page is 3.5:1, below the 4.5:1 that body-size text needs (DESIGN.md).
const linkClassName =
  'break-words rounded-full font-semibold text-foreground underline decoration-2 decoration-primary underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

function termsLink(href: string, opensNewTab: boolean) {
  return function TermsLink(chunks: ReactNode) {
    return (
      <a
        href={href}
        target={opensNewTab ? '_blank' : undefined}
        rel={opensNewTab ? 'noopener noreferrer' : undefined}
        className={linkClassName}
      >
        {chunks}
      </a>
    );
  };
}

/**
 * Values for `t.rich()` in the terms: `<strong>` for the emphasized phrases,
 * `<email>` for the contact address and `<repository>` for the source code.
 * Each link tag takes its visible text from the matching `address` or
 * `repositoryUrl` value, so the translations only place it.
 */
export const termsRichText = {
  address: CONTACT_EMAIL,
  repositoryUrl: REPOSITORY_URL,
  strong: (chunks: ReactNode) => (
    <strong className="font-semibold">{chunks}</strong>
  ),
  email: termsLink(`mailto:${CONTACT_EMAIL}`, false),
  repository: termsLink(REPOSITORY_URL, true),
};
