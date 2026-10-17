import type { EmailMessage } from './email.job.js';
import { buildTermsUrl, renderEmailLayout } from './email-layout.js';
import type { EmailLocale } from './email-locale.js';

type AccountExistsEmailCopy = {
  subject: string;
  intro: string;
  action: string;
  ignore: string;
  footerNote: string;
};

// User-facing copy lives only here, one entry per locale.
const MESSAGES = {
  en: {
    subject: 'You already have a notefinder account',
    intro:
      'Someone tried to create a notefinder account with this email, but it already has one.',
    action:
      'If it was you, sign in instead. Forgot your password? Use "Forgot password" on the sign-in page to get a reset code.',
    ignore: "If it wasn't you, ignore this email. Your account hasn't changed.",
    footerNote:
      'You received this email because someone tried to create a notefinder account with this address.',
  },
  'pt-BR': {
    subject: 'Você já tem uma conta no notefinder',
    intro:
      'Alguém tentou criar uma conta no notefinder com este email, mas ele já tem uma.',
    action:
      'Se foi você, é só entrar. Esqueceu a senha? Use "Esqueci minha senha" na página de entrar para receber um código.',
    ignore: 'Se não foi você, ignore este email. Nada mudou na sua conta.',
    footerNote:
      'Você recebeu este email porque alguém tentou criar uma conta no notefinder com este email.',
  },
} as const satisfies Record<EmailLocale, AccountExistsEmailCopy>;

export type AccountExistsEmailInput = {
  to: string;
  locale: EmailLocale;
  /** Site base for footer links (env.WEB_URL in production). */
  webUrl?: string;
};

/**
 * Sent instead of a verification code when someone signs up with an email
 * that already has an account. Sign-up answers the same way in both cases
 * (so it doesn't reveal which emails exist); this email tells the owner what
 * to do instead of leaving them waiting for a code.
 */
export const renderAccountExistsEmail = ({
  to,
  locale,
  webUrl,
}: AccountExistsEmailInput): EmailMessage => {
  const copy: AccountExistsEmailCopy = MESSAGES[locale];

  const text = [copy.intro, '', copy.action, '', copy.ignore].join('\n');
  const html = renderEmailLayout({
    locale,
    preheader: copy.intro,
    title: copy.subject,
    intro: copy.intro,
    details: [copy.action],
    closing: copy.ignore,
    footerNote: copy.footerNote,
    termsUrl: buildTermsUrl(webUrl, locale),
  });

  return { to, subject: copy.subject, html, text };
};
