import type { EmailMessage } from './email.job.js';
import { escapeHtml, renderEmailDocument } from './email-html.js';
import type { EmailLocale } from './email-locale.js';

const COPY = {
  en: {
    subject: 'Keep your practice streak on notefinder',
    body: 'You reached your daily target yesterday. There is still time to practice today and keep your streak!',
    link: 'Start practicing',
  },
  'pt-BR': {
    subject: 'Mantenha sua sequência de prática no notefinder',
    body: 'Você atingiu sua meta diária ontem. Ainda dá tempo de praticar hoje e manter sua sequência!',
    link: 'Começar a praticar',
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
    html: renderEmailDocument(
      input.locale,
      `    <p style="margin:0 0 16px;">${escapeHtml(copy.body)}</p>\n    <p style="margin:0;"><a href="${escapeHtml(input.siteUrl)}">${escapeHtml(copy.link)}</a></p>`,
    ),
  };
}
