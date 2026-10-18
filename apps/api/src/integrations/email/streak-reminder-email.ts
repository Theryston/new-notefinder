import type { EmailMessage } from './email.job.js';
import {
  emailButton,
  emailParagraph,
  renderEmailLayout,
} from './email-layout.js';
import type { EmailLocale } from './email-locale.js';

const COPY = {
  en: {
    subject: 'Keep your practice streak on notefinder',
    overline: 'Practice streak',
    title: 'Keep it going',
    preheader: 'Practice today to keep your streak going.',
    reason:
      'You got this email because daily practice reminders are on for your notefinder account.',
    body: 'You reached your daily target yesterday. There is still time to practice today and keep your streak!',
    link: 'Start practicing',
  },
  'pt-BR': {
    subject: 'Mantenha sua sequência de prática no notefinder',
    overline: 'Sequência de prática',
    title: 'Continue assim',
    preheader: 'Pratique hoje para manter sua sequência.',
    reason:
      'Você recebeu este email porque os lembretes diários de prática estão ativados na sua conta do notefinder.',
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
    html: renderEmailLayout({
      locale: input.locale,
      subject: copy.subject,
      preheader: copy.preheader,
      overline: copy.overline,
      title: copy.title,
      body: [
        emailParagraph(copy.body),
        emailButton(input.siteUrl, copy.link),
      ].join('\n'),
      reason: copy.reason,
    }),
  };
}
