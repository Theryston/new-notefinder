import {
  renderTrackCompletedEmail,
  renderTrackFailedEmail,
} from './track-processing-email.js';

const track = {
  title: 'Bohemian Rhapsody',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  coverUrl: 'https://cdn.notefinder.test/covers/track-1.webp',
  // E2 to A4, as MIDI numbers.
  vocalRange: { lowest: 40, highest: 69 },
};

const input = {
  to: 'ana@example.com',
  trackUrl: 'https://notefinder.test/pt-BR/tracks/track-1?x=1&y=2',
  webUrl: 'https://notefinder.test',
  track,
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

  it('shows the track title, artist and vocal range in the featured block', () => {
    const message = renderTrackCompletedEmail({ ...input, locale: 'en' });

    expect(message.html).toContain('Bohemian Rhapsody');
    expect(message.html).toContain('Queen · <span');
    expect(message.html).toContain('E2–A4');
  });

  it('shows the cover at 72px when the track has one', () => {
    const message = renderTrackCompletedEmail({ ...input, locale: 'en' });

    expect(message.html).toContain(
      'src="https://cdn.notefinder.test/covers/track-1.webp"',
    );
    expect(message.html).toContain('width="72"');
  });

  it('renders no image without a cover, and no range without notes', () => {
    const message = renderTrackFailedEmail({
      ...input,
      locale: 'en',
      track: { ...track, coverUrl: null, vocalRange: null },
    });

    expect(message.html).not.toContain('width="72"');
    expect(message.html).toContain('>Queen</p>');
    expect(message.html).not.toContain('E2');
  });

  it('puts the title and artist in the plain-text body', () => {
    const message = renderTrackFailedEmail({ ...input, locale: 'pt-BR' });

    expect(message.text).toContain('Bohemian Rhapsody');
    expect(message.text).toContain('Queen · E2–A4');
  });

  it('escapes the track title in the HTML', () => {
    const message = renderTrackFailedEmail({
      ...input,
      locale: 'en',
      track: { ...track, title: 'Tom & <b>Jerry</b>' },
    });

    expect(message.html).toContain('Tom &amp; &lt;b&gt;Jerry&lt;/b&gt;');
  });
});
