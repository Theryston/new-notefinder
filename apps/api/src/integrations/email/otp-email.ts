import type { EmailMessage } from './email.job.js';
import { renderEmailLayout } from './email-layout.js';
import type { EmailLocale } from './email-locale.js';

/** One-time-code emails the app sends (email verification, password reset). */
export type OtpEmailType = 'email-verification' | 'forget-password';

type OtpEmailCopy = {
  subject: string;
  intro: string;
  expiry: (minutes: number) => string;
  ignore: string;
  footerNote: string;
};

// User-facing copy lives only here, one entry per locale and email type.
const MESSAGES = {
  en: {
    'email-verification': {
      subject: 'Your notefinder verification code',
      intro: 'Use this code to verify your email on notefinder:',
      expiry: (minutes) => `The code expires in ${minutes} minutes.`,
      ignore: "If you didn't create a notefinder account, ignore this email.",
      footerNote:
        'You received this email because you tried to sign in to notefinder.',
    },
    'forget-password': {
      subject: 'Your notefinder password reset code',
      intro: 'Use this code to reset your notefinder password:',
      expiry: (minutes) => `The code expires in ${minutes} minutes.`,
      ignore:
        "If you didn't ask to reset your password, ignore this email. Your password stays the same.",
      footerNote:
        'You received this email because you asked to reset your notefinder password.',
    },
  },
  'pt-BR': {
    'email-verification': {
      subject: 'Seu código de verificação do notefinder',
      intro: 'Use este código para verificar seu email no notefinder:',
      expiry: (minutes) => `O código expira em ${minutes} minutos.`,
      ignore: 'Se você não criou uma conta no notefinder, ignore este email.',
      footerNote: 'Você recebeu este email porque tentou entrar no notefinder.',
    },
    'forget-password': {
      subject: 'Seu código para redefinir a senha do notefinder',
      intro: 'Use este código para redefinir sua senha do notefinder:',
      expiry: (minutes) => `O código expira em ${minutes} minutos.`,
      ignore:
        'Se você não pediu para redefinir sua senha, ignore este email. Sua senha continua a mesma.',
      footerNote:
        'Você recebeu este email porque pediu para redefinir sua senha do notefinder.',
    },
  },
} as const satisfies Record<EmailLocale, Record<OtpEmailType, OtpEmailCopy>>;

export type OtpEmailInput = {
  to: string;
  type: OtpEmailType;
  otp: string;
  locale: EmailLocale;
  expiresInMinutes: number;
};

export const renderOtpEmail = ({
  to,
  type,
  otp,
  locale,
  expiresInMinutes,
}: OtpEmailInput): EmailMessage => {
  const copy: OtpEmailCopy = MESSAGES[locale][type];
  const expiry = copy.expiry(expiresInMinutes);

  const text = [copy.intro, '', otp, '', expiry, copy.ignore].join('\n');
  const html = renderEmailLayout({
    locale,
    preheader: `${copy.intro} ${otp}. ${expiry}`,
    title: copy.subject,
    intro: copy.intro,
    details: [expiry],
    highlight: otp,
    closing: copy.ignore,
    footerNote: copy.footerNote,
  });

  return { to, subject: copy.subject, html, text };
};
