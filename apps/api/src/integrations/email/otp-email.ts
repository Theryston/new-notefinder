import type { EmailMessage } from './email.job.js';
import { escapeHtml } from './email-html.js';
import {
  type EmailWebOrigin,
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
      subject: 'Your vozzify verification code',
      overline: 'Email verification',
      title: 'Your code',
      intro: 'Use this code to verify your email on vozzify:',
      expiry: (minutes) => `The code expires in ${minutes} minutes.`,
      preheader: (otp, minutes) =>
        `Your code is ${otp}. It expires in ${minutes} minutes.`,
      reason:
        'You got this email because someone asked to verify this address on Vozzify.',
      ignore: "If you didn't create a vozzify account, ignore this email.",
    },
    'forget-password': {
      subject: 'Your vozzify password reset code',
      overline: 'Password reset',
      title: 'Your code',
      intro: 'Use this code to reset your vozzify password:',
      expiry: (minutes) => `The code expires in ${minutes} minutes.`,
      preheader: (otp, minutes) =>
        `Your code is ${otp}. It expires in ${minutes} minutes.`,
      reason:
        'You got this email because someone asked to reset the password of this Vozzify account.',
      ignore:
        "If you didn't ask to reset your password, ignore this email. Your password stays the same.",
    },
  },
  'pt-BR': {
    'email-verification': {
      subject: 'Seu código de verificação do vozzify',
      overline: 'Verificação de email',
      title: 'Seu código',
      intro: 'Use este código para verificar seu email no vozzify:',
      expiry: (minutes) => `O código expira em ${minutes} minutos.`,
      preheader: (otp, minutes) =>
        `Seu código é ${otp}. Ele expira em ${minutes} minutos.`,
      reason:
        'Você recebeu este email porque alguém pediu para verificar este endereço no Vozzify.',
      ignore: 'Se você não criou uma conta no vozzify, ignore este email.',
    },
    'forget-password': {
      subject: 'Seu código para redefinir a senha do vozzify',
      overline: 'Redefinir senha',
      title: 'Seu código',
      intro: 'Use este código para redefinir sua senha do vozzify:',
      expiry: (minutes) => `O código expira em ${minutes} minutos.`,
      preheader: (otp, minutes) =>
        `Seu código é ${otp}. Ele expira em ${minutes} minutos.`,
      reason:
        'Você recebeu este email porque alguém pediu para redefinir a senha desta conta do Vozzify.',
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
  // Right padding is smaller than left by the trailing letter-spacing (0.35em
  // of 30px, about 10px), so the digits sit centered. Plain px: clients that
  // drop calc() would otherwise lose the padding entirely.
  `<div style="display:inline-block;border:2px solid #09090B;border-radius:999px;padding:10px 16px 10px 26px;margin:0 0 20px;font-family:'Geist Mono',ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:600;letter-spacing:0.35em;">${escapeHtml(otp)}</div>`;

export const renderOtpEmail = ({
  to,
  type,
  otp,
  locale,
  expiresInMinutes,
  webUrl,
}: OtpEmailInput & EmailWebOrigin): EmailMessage => {
  const copy: OtpEmailCopy = MESSAGES[locale][type];
  const expiry = copy.expiry(expiresInMinutes);

  const text = [copy.intro, '', otp, '', expiry, copy.ignore].join('\n');
  const html = renderEmailLayout({
    locale,
    webUrl,
    subject: copy.subject,
    preheader: copy.preheader(otp, expiresInMinutes),
    overline: copy.overline,
    title: copy.title,
    body: [
      emailParagraph(copy.intro),
      codePill(otp),
      emailNote(`${expiry} ${copy.ignore}`),
    ].join('\n'),
    reason: copy.reason,
  });

  return { to, subject: copy.subject, html, text };
};
