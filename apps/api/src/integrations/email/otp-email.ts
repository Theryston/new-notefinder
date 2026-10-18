import type { EmailMessage } from './email.job.js';
import { escapeHtml } from './email-html.js';
import {
  emailNote,
  emailParagraph,
  renderEmailLayout,
} from './email-layout.js';
import type { EmailLocale } from './email-locale.js';

/** One-time-code emails the app sends (email verification, password reset). */
export type OtpEmailType = 'email-verification' | 'forget-password';

type OtpEmailCopy = {
  subject: string;
  overline: string;
  title: string;
  intro: string;
  expiry: (minutes: number) => string;
  preheader: (otp: string, minutes: number) => string;
  reason: string;
  ignore: string;
};

// User-facing copy lives only here, one entry per locale and email type.
const MESSAGES = {
  en: {
    'email-verification': {
      subject: 'Your notefinder verification code',
      overline: 'Email verification',
      title: 'Your code',
      intro: 'Use this code to verify your email on notefinder:',
      expiry: (minutes) => `The code expires in ${minutes} minutes.`,
      preheader: (otp, minutes) =>
        `Your code is ${otp}. It expires in ${minutes} minutes.`,
      reason:
        'You got this email because someone asked to verify this address on notefinder.',
      ignore: "If you didn't create a notefinder account, ignore this email.",
    },
    'forget-password': {
      subject: 'Your notefinder password reset code',
      overline: 'Password reset',
      title: 'Your code',
      intro: 'Use this code to reset your notefinder password:',
      expiry: (minutes) => `The code expires in ${minutes} minutes.`,
      preheader: (otp, minutes) =>
        `Your code is ${otp}. It expires in ${minutes} minutes.`,
      reason:
        'You got this email because someone asked to reset the password of this notefinder account.',
      ignore:
        "If you didn't ask to reset your password, ignore this email. Your password stays the same.",
    },
  },
  'pt-BR': {
    'email-verification': {
      subject: 'Seu código de verificação do notefinder',
      overline: 'Verificação de email',
      title: 'Seu código',
      intro: 'Use este código para verificar seu email no notefinder:',
      expiry: (minutes) => `O código expira em ${minutes} minutos.`,
      preheader: (otp, minutes) =>
        `Seu código é ${otp}. Ele expira em ${minutes} minutos.`,
      reason:
        'Você recebeu este email porque alguém pediu para verificar este endereço no notefinder.',
      ignore: 'Se você não criou uma conta no notefinder, ignore este email.',
    },
    'forget-password': {
      subject: 'Seu código para redefinir a senha do notefinder',
      overline: 'Redefinir senha',
      title: 'Seu código',
      intro: 'Use este código para redefinir sua senha do notefinder:',
      expiry: (minutes) => `O código expira em ${minutes} minutos.`,
      preheader: (otp, minutes) =>
        `Seu código é ${otp}. Ele expira em ${minutes} minutos.`,
      reason:
        'Você recebeu este email porque alguém pediu para redefinir a senha desta conta do notefinder.',
      ignore:
        'Se você não pediu para redefinir sua senha, ignore este email. Sua senha continua a mesma.',
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

/** The code sits in one pill, so it reads as a single unit. */
const codePill = (otp: string): string =>
  `<div style="display:inline-block;border:2px solid #09090B;border-radius:999px;padding:10px 26px;margin:0 0 20px;font-family:'Geist Mono',ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:600;letter-spacing:0.35em;padding-right:calc(26px - 0.35em);">${escapeHtml(otp)}</div>`;

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
    subject: copy.subject,
    preheader: copy.preheader(otp, expiresInMinutes),
    overline: copy.overline,
    title: copy.title,
    body: [
      emailParagraph(copy.intro),
      codePill(otp),
      emailParagraph(expiry),
      emailNote(copy.ignore),
    ].join('\n'),
    reason: copy.reason,
  });

  return { to, subject: copy.subject, html, text };
};
