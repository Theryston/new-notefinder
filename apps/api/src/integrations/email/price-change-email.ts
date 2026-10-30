import type { Locale, PlanCurrency } from '@vozzify/contracts';
import type { EmailMessage } from './email.job.js';
import {
  emailButton,
  emailParagraph,
  renderEmailFromCopy,
} from './email-layout.js';
import en from './locales/price-change-en.json' with { type: 'json' };
import ptBR from './locales/price-change-pt-br.json' with { type: 'json' };

export function renderPriceChangeEmail(input: {
  to: string;
  locale: Locale;
  webUrl: string;
  currency: PlanCurrency;
  oldAmount: number;
  newAmount: number;
  effectiveAt: Date;
}): EmailMessage {
  const copy = input.locale === 'pt-BR' ? ptBR : en;
  const money = new Intl.NumberFormat(input.locale, {
    style: 'currency',
    currency: input.currency,
  });
  const date = new Intl.DateTimeFormat(input.locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(input.effectiveAt);
  const lines = [
    `${copy.oldPrice}: ${money.format(input.oldAmount / 100)}`,
    `${copy.newPrice}: ${money.format(input.newAmount / 100)}`,
    `${copy.effective}: ${date}`,
    copy.manage,
  ];
  const url = `${input.webUrl}/${input.locale}/subscription`;
  return {
    to: input.to,
    subject: copy.subject,
    text: `${lines.join('\n')}\n\n${copy.button}: ${url}`,
    html: renderEmailFromCopy(
      input,
      copy,
      `${lines.map(emailParagraph).join('')}${emailButton(url, copy.button)}`,
    ),
  };
}
