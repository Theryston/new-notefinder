import type { EmailMessage } from './email.job.js';
import { escapeHtml, renderEmailDocument } from './email-html.js';
import type { EmailLocale } from './email-locale.js';

type TrackEmailCopy = {
  subject: string;
  intro: string;
  action: string;
  link: string;
};

// User-facing copy lives only here, one entry per locale.
const COMPLETED = {
  en: {
    subject: 'Your notes are ready on notefinder',
    intro:
      'The vocal notes and timed lyrics of a track you contributed to are ready.',
    action: 'Open the track to start practicing.',
    link: 'Open the track',
  },
  'pt-BR': {
    subject: 'As notas da sua música estão prontas no notefinder',
    intro:
      'As notas vocais e a letra sincronizada de uma música em que você participou estão prontas.',
    action: 'Abra a música para começar a praticar.',
    link: 'Abrir a música',
  },
} as const satisfies Record<EmailLocale, TrackEmailCopy>;

const FAILED = {
  en: {
    subject: 'We could not finish the notes of a track',
    intro:
      'The processing of a track you contributed to failed before its notes were ready.',
    action:
      'Open the track to see why. If the failure can be retried, you can try again there.',
    link: 'Open the track',
  },
  'pt-BR': {
    subject: 'Não conseguimos terminar as notas de uma música',
    intro:
      'O processamento de uma música em que você participou falhou antes de as notas ficarem prontas.',
    action:
      'Abra a música para ver o motivo. Se for possível tentar de novo, você pode fazer isso por lá.',
    link: 'Abrir a música',
  },
} as const satisfies Record<EmailLocale, TrackEmailCopy>;

/** One Contributor's email: where it goes, in which language, and the Track's page. */
export type TrackEmailInput = {
  to: string;
  locale: EmailLocale;
  trackUrl: string;
};

const renderTrackEmail = (
  copy: TrackEmailCopy,
  { to, locale, trackUrl }: TrackEmailInput,
): EmailMessage => {
  const text = [copy.intro, '', copy.action, '', `${copy.link}: ${trackUrl}`];
  const html = renderEmailDocument(
    locale,
    `    <p style="margin:0 0 16px;">${escapeHtml(copy.intro)}</p>
    <p style="margin:0 0 16px;">${escapeHtml(copy.action)}</p>
    <p style="margin:0;"><a href="${escapeHtml(trackUrl)}">${escapeHtml(copy.link)}</a></p>`,
  );
  return { to, subject: copy.subject, html, text: text.join('\n') };
};

/** Sent to every Contributor of a Track whose Processing completed. */
export const renderTrackCompletedEmail = (
  input: TrackEmailInput,
): EmailMessage => renderTrackEmail(COMPLETED[input.locale], input);

/** Sent to every Contributor of a Track whose Processing failed. */
export const renderTrackFailedEmail = (input: TrackEmailInput): EmailMessage =>
  renderTrackEmail(FAILED[input.locale], input);
