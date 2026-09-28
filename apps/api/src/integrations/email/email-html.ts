import type { EmailLocale } from './email-locale.js';

export const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Wraps already-escaped body markup in the shared email document. */
export const renderEmailDocument = (
  locale: EmailLocale,
  body: string,
): string => `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
${body}
  </body>
</html>`;
