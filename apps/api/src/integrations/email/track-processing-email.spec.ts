import {
  renderTrackCompletedEmail,
  renderTrackFailedEmail,
} from './track-processing-email.js';

const input = {
  to: 'ana@example.com',
  trackUrl: 'https://notefinder.test/pt-BR/tracks/track-1?x=1&y=2',
};

describe('track processing emails', () => {
  it('writes the completed email in the Contributor language, with the link', () => {
    const message = renderTrackCompletedEmail({ ...input, locale: 'pt-BR' });

    expect(message).toMatchObject({
      to: 'ana@example.com',
      subject: 'As notas da sua música estão prontas no notefinder',
    });
    expect(message.text).toContain(input.trackUrl);
    expect(message.html).toContain('lang="pt-BR"');
  });

  it('writes the failed email in English', () => {
    const message = renderTrackFailedEmail({ ...input, locale: 'en' });

    expect(message.subject).toBe('We could not finish the notes of a track');
    expect(message.html).toContain('lang="en"');
  });

  it('escapes the link in the HTML, not in the text', () => {
    const message = renderTrackFailedEmail({ ...input, locale: 'en' });

    expect(message.html).toContain('x=1&amp;y=2');
    expect(message.text).toContain('x=1&y=2');
  });
});
