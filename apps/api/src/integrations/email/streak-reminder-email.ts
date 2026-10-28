import type { EmailMessage } from './email.job.js';
import {
  type EmailWebOrigin,
  emailButton,
  emailParagraph,
  renderEmailFromCopy,
} from './email-layout.js';
import type { EmailLocale } from './email-locale.js';

const COPY = {
  en: {
    subject: 'Keep your practice streak on vozzify',
    overline: 'Practice streak',
    title: 'Keep it going',
    preheader: 'Practice today to keep your streak going.',
    reason:
      'You got this email because daily practice reminders are on for your Vozzify account.',
    body: 'You reached your daily target yesterday. There is still time to practice today and keep your streak!',
    link: 'Start practicing',
  },
  'pt-BR': {
    subject: 'Mantenha sua sequência de prática no vozzify',
    overline: 'Sequência de prática',
    title: 'Continue assim',
    preheader: 'Pratique hoje para manter sua sequência.',
    reason:
      'Você recebeu este email porque os lembretes diários de prática estão ativados na sua conta do Vozzify.',
    body: 'Você atingiu sua meta diária ontem. Ainda dá tempo de praticar hoje e manter sua sequência!',
    link: 'Começar a praticar',
  },
} as const;

export function renderStreakReminderEmail(
  input: {
    to: string;
    locale: EmailLocale;
    siteUrl: string;
  } & EmailWebOrigin,
): EmailMessage {
  const copy = COPY[input.locale];
  return {
    to: input.to,
    subject: copy.subject,
    text: `${copy.body}\n\n${copy.link}: ${input.siteUrl}`,
    html: renderEmailFromCopy(
      { locale: input.locale, webUrl: input.webUrl },
      copy,
      [emailParagraph(copy.body), emailButton(input.siteUrl, copy.link)].join(
        '\n',
      ),
    ),
  };
}
