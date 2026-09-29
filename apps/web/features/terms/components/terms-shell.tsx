import type { ReactNode } from 'react';

/**
 * Frame for the terms: a reading column (`max-w-prose`, so lines stay near
 * 65 characters) under the site header, which the `(site)` layout provides.
 */
export function TermsShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-prose px-4 pt-8 pb-16 md:px-6 md:pb-24">
      {children}
    </div>
  );
}
