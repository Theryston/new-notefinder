import mjml2html from 'mjml';
import { readWebUrl } from '../../config/env.js';
import { escapeHtml } from './email-html.js';
import { EMAIL_LAYOUT_MJML } from './email-layout-skeleton.js';
import type { EmailLocale } from './email-locale.js';

/**
 * Compiles MJML to HTML and throws on any MJML error, so a broken layout
 * fails at boot instead of sending a half-rendered email.
 */
export const compileMjml = async (source: string): Promise<string> => {
  // `soft` returns the errors instead of throwing, so one message covers
  // every failure; the errors check below decides whether the layout is used.
  const { html, errors } = await mjml2html(source, {
    validationLevel: 'soft',
  });
  if (errors.length > 0) {
    const reasons = errors.map((error) => error.formattedMessage).join('; ');
    throw new Error(`MJML email layout does not compile: ${reasons}`);
  }
  // Keep only `<html lang="…">`: MJML adds `dir` and XML namespace attributes
  // for Outlook's VML and office conditionals, which the layout does not use.
  // The `lang` slot is filled in at render time, like every other slot.
  return html.replace(/<html\b[^>]*>/, '<html lang="NFSLOT_LANG">');
};

// Compiled once at module load (top-level await), so rendering stays
// synchronous: the render functions are called from plain code and specs.
const LAYOUT = await compileMjml(EMAIL_LAYOUT_MJML);

const SLOT_PATTERN =
  /NFSLOT_(LANG|SUBJECT|PREHEADER|OVERLINE|TITLE|BODY|FOOTER)/g;

type Slot =
  | 'LANG'
  | 'SUBJECT'
  | 'PREHEADER'
  | 'OVERLINE'
  | 'TITLE'
  | 'BODY'
  | 'FOOTER';

type FooterCopy = { terms: string; otherLanguage: string };

// User-facing copy lives only here, one entry per locale.
const FOOTER_COPY = {
  en: { terms: 'Terms of use', otherLanguage: 'Ler em português' },
  'pt-BR': { terms: 'Termos de uso', otherLanguage: 'Read in English' },
} as const satisfies Record<EmailLocale, FooterCopy>;

const OTHER_LOCALE = {
  en: 'pt-BR',
  'pt-BR': 'en',
} as const satisfies Record<EmailLocale, EmailLocale>;

export type EmailLayoutInput = {
  locale: EmailLocale;
  /** The document title; not shown in the body. */
  subject: string;
  /** Hidden inbox preview text, next to the subject. */
  preheader: string;
  /** Small uppercase label above the title. */
  overline: string;
  /** Display title inside the featured block. */
  title: string;
  /** Trusted markup for the body; build it with the `email-layout` helpers. */
  body: string;
  /** Why the recipient got this email, shown in the footer. */
  reason: string;
};

const footerLink = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}" style="color:#71717A;">${escapeHtml(label)}</a>`;

/**
 * The footer links point at the web app. Every email builds its footer here,
 * so they all use the same origin: `WEB_URL` from the config module, which
 * is the one the app itself was booted with.
 */
const footerHtml = ({ locale, reason }: EmailLayoutInput): string => {
  const copy: FooterCopy = FOOTER_COPY[locale];
  const webUrl = readWebUrl();
  const links = [
    footerLink(`${webUrl}/${locale}/terms`, copy.terms),
    footerLink(`${webUrl}/${OTHER_LOCALE[locale]}`, copy.otherLanguage),
  ];
  return `${escapeHtml(reason)}<br />${links.join(' · ')}`;
};

/**
 * Fills every slot of the compiled layout in one pass: a value is never
 * scanned for slots, so user content cannot collide with the template.
 */
export const renderEmailLayout = (input: EmailLayoutInput): string => {
  const values: Record<Slot, string> = {
    LANG: escapeHtml(input.locale),
    SUBJECT: escapeHtml(input.subject),
    PREHEADER: escapeHtml(input.preheader),
    OVERLINE: escapeHtml(input.overline),
    TITLE: escapeHtml(input.title),
    BODY: input.body,
    FOOTER: footerHtml(input),
  };
  return LAYOUT.replace(SLOT_PATTERN, (_match, slot: Slot) => values[slot]);
};

/** A body paragraph; the text is escaped here. */
export const emailParagraph = (text: string): string =>
  `<p style="margin:0 0 16px;max-width:44ch;">${escapeHtml(text)}</p>`;

/** A quiet, smaller paragraph for a closing remark. */
export const emailNote = (text: string): string =>
  `<p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:#71717A;">${escapeHtml(text)}</p>`;

/** The pill call to action: black on white, below the featured block. */
export const emailButton = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#09090B;color:#FFFFFF;font-weight:600;font-size:15px;line-height:48px;height:48px;padding:0 28px;border-radius:999px;text-decoration:none;">${escapeHtml(label)}</a>`;
