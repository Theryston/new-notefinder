import mjml2html from 'mjml';
import { z } from 'zod';
import { escapeHtml } from './email-html.js';
import type { EmailLocale } from './email-locale.js';

// Emails use the fixed light palette from DESIGN.md: clients get no
// dark-mode variant, so the hex values travel with the markup.
const INK = '#09090B';
const MUTED = '#71717A';
const FILL = '#F3F3F5';
const RULE = '#E4E4E8';
const BRAND = '#FA4900';
const PAGE = '#FFFFFF';

const SANS =
  "Figtree,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = 'Geist Mono,ui-monospace,Menlo,monospace';

// Every production caller passes the site base: the auth emails get
// env.WEB_URL threaded from auth.ts, and the others give the page URL they
// already carry. Only unit specs that call the renderers and EmailService
// directly skip it, so the production site stands in for them.
const DEFAULT_WEB_URL = 'https://notefinder.com.br';

// Footer copy the layout itself renders, per locale (web: footer.terms).
const FOOTER_COPY = {
  en: { termsLabel: 'Terms of use' },
  'pt-BR': { termsLabel: 'Termos de uso' },
} as const satisfies Record<EmailLocale, { termsLabel: string }>;

/** Pill CTA of the emails that link somewhere (track page, practice). */
type EmailCta = {
  /** Visible label, already translated. */
  label: string;
  /** Full URL of the linked page. */
  href: string;
};

export type EmailLayoutInput = {
  locale: EmailLocale;
  /** Inbox preview, hidden in the body. Plain text, escaped by the layout. */
  preheader: string;
  /** Heading of the email; templates reuse their subject. Plain text. */
  title: string;
  /** Opening paragraph. Plain text. */
  intro: string;
  /** Extra paragraphs after the intro (e.g. an expiry line). Plain text. */
  details: string[];
  /** Single code rendered as a letter-spaced pill. Plain text. */
  code?: string;
  /** Quiet closing line (e.g. "ignore this email"). Plain text. */
  closing?: string;
  cta?: EmailCta;
  /** Quiet reason line shown above the Terms link. Plain text. */
  footerNote: string;
  /** Terms page of the web app for this locale; see buildTermsUrl. */
  termsUrl: string;
};

/**
 * Terms link of the email footer: the web app's `/{locale}/terms` page.
 * Templates pass the page URL they already carry (track, practice) or the
 * site base (auth, env.WEB_URL); without one the production site stands in.
 */
export const buildTermsUrl = (
  url: string | undefined,
  locale: EmailLocale,
): string => {
  const origin = url === undefined ? DEFAULT_WEB_URL : new URL(url).origin;
  return `${origin}/${locale}/terms`;
};

const localeTag = (locale: EmailLocale): string =>
  locale === 'pt-BR' ? 'PT' : 'EN';

// mjml 4 renders synchronously, but its DefinitelyTyped types follow
// mjml-core 5 (async), so the boundary is parsed with the app's Zod instead
// of trusting the import type. A mjml major upgrade breaks the email specs
// loudly here instead of shipping silent garbage.
const mjmlResultSchema = z.object({
  html: z.string(),
  errors: z.array(z.unknown()),
});

const renderCta = (cta: EmailCta): string =>
  `        <mj-table>
          <tr><td align="left" style="padding:12px 0 28px;"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background-color:${BRAND};color:${PAGE};font-family:${SANS};font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;padding:12px 28px;">${escapeHtml(cta.label)}</a></td></tr>
        </mj-table>`;

const renderBody = (input: EmailLayoutInput): string => {
  const parts = [
    `        <mj-table><tr><td align="left" style="padding:0 0 28px;"><div style="width:32px;height:4px;border-radius:999px;background-color:${BRAND};font-size:0;line-height:0;">&nbsp;</div></td></tr></mj-table>`,
    `        <mj-text font-size="18px" font-weight="700" padding="0 0 8px">NoteFinder</mj-text>`,
    `        <mj-text font-size="24px" font-weight="800" padding="0 0 8px">${escapeHtml(input.title)}</mj-text>`,
    `        <mj-text>${escapeHtml(input.intro)}</mj-text>`,
  ];
  if (input.code !== undefined) {
    parts.push(
      `        <mj-text padding="0 0 24px"><div style="background-color:${FILL};border-radius:12px;padding:12px 24px;display:inline-block;font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:8px;color:${INK};">${escapeHtml(input.code)}</div></mj-text>`,
    );
  }
  for (const detail of input.details) {
    parts.push(`        <mj-text>${escapeHtml(detail)}</mj-text>`);
  }
  if (input.closing !== undefined) {
    parts.push(
      `        <mj-text font-size="14px" color="${MUTED}" padding="0 0 28px">${escapeHtml(input.closing)}</mj-text>`,
    );
  }
  if (input.cta !== undefined) {
    parts.push(renderCta(input.cta));
  }
  parts.push(
    `        <mj-divider border-color="${RULE}" border-width="1px" padding="0 0 16px" />`,
    `        <mj-text font-size="12px" color="${MUTED}" padding="0">${escapeHtml(input.footerNote)}<br /><a href="${escapeHtml(input.termsUrl)}" style="color:${MUTED};">${escapeHtml(FOOTER_COPY[input.locale].termsLabel)}</a> · ${localeTag(input.locale)}</mj-text>`,
  );
  return parts.join('\n');
};

const renderDocument = (input: EmailLayoutInput): string =>
  `<mjml>
  <mj-head>
    <mj-title>${escapeHtml(input.title)}</mj-title>
    <mj-preview>${escapeHtml(input.preheader)}</mj-preview>
    <mj-attributes>
      <mj-text font-family="${SANS}" color="${INK}" font-size="16px" line-height="1.5" padding="0 0 16px" />
      <mj-section padding="0" />
      <mj-column padding="0" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${PAGE}" width="600px">
    <mj-section padding="40px 20px 0">
      <mj-column>
${renderBody(input)}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

/**
 * Renders the shared Doc skeleton (hairline, brand, title, quiet footer)
 * around already-translated copy. Every string but the MJML tags is escaped
 * here, so templates pass plain text. Throws when MJML reports a validation
 * error, so a broken skeleton fails the specs instead of shipping.
 */
export const renderEmailLayout = (input: EmailLayoutInput): string => {
  const { html, errors } = mjmlResultSchema.parse(
    mjml2html(renderDocument(input), { validationLevel: 'soft' }),
  );
  if (errors.length > 0) {
    throw new Error(`Invalid email MJML: ${JSON.stringify(errors)}`);
  }
  // mjml emits its own lang (und); the app asserts the exact locale tag.
  return html.replace(/<html[^>]*>/, `<html lang="${input.locale}">`);
};
