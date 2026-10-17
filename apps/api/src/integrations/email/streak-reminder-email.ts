import type { EmailMessage } from './email.job.js';
import { buildTermsUrl, renderEmailLayout } from './email-layout.js';
import type { EmailLocale } from './email-locale.js';

const COPY = {
  en: {
    subject: 'Keep your practice streak on notefinder',
    body: 'You reached your daily target yesterday. There is still time to practice today and keep your streak!',
    link: 'Start practicing',
    footerNote: 'You received this email because you practice on notefinder.',
  },
  'pt-BR': {
    subject: 'Mantenha sua sequência de prática no notefinder',
    body: 'Você atingiu sua meta diária ontem. Ainda dá tempo de praticar hoje e manter sua sequência!',
    link: 'Começar a praticar',
    footerNote: 'Você recebeu este email porque pratica no notefinder.',
  },
} as const;

export function renderStreakReminderEmail(input: {
  to: string;
  locale: EmailLocale;
  siteUrl: string;
}): EmailMessage {
  const copy = COPY[input.locale];
  return {
    to: input.to,
    subject: copy.subject,
    text: `${copy.body}\n\n${copy.link}: ${input.siteUrl}`,
    html: renderEmailLayout({
      locale: input.locale,
      preheader: copy.body,
      title: copy.subject,
      intro: copy.body,
      details: [],
      cta: { label: copy.link, href: input.siteUrl },
      footerNote: copy.footerNote,
      termsUrl: buildTermsUrl(input.siteUrl, input.locale),
    }),
  };
}
