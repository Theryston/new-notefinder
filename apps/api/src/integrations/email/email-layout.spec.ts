import {
  buildTermsUrl,
  type EmailLayoutInput,
  renderEmailLayout,
} from './email-layout.js';
import { EMAIL_LOCALES } from './email-locale.js';

const baseInput = (locale: EmailLayoutInput['locale']): EmailLayoutInput => ({
  locale,
  preheader: 'Preview of the email',
  title: 'Your code',
  intro: 'Use this code to practice:',
  details: ['It expires in 10 minutes.'],
  footerNote: 'You got this because you practice on notefinder.',
  termsUrl: `https://notefinder.test/${locale}/terms`,
});

describe('renderEmailLayout', () => {
  it.each(EMAIL_LOCALES)(
    'renders the Doc skeleton with preheader, footer and lang="%s"',
    (locale) => {
      const html = renderEmailLayout(baseInput(locale));

      expect(html).toContain(`<html lang="${locale}">`);
      // Brand hairline, brand name, title and intro.
      expect(html).toContain('#FA4900');
      expect(html).toContain('NoteFinder');
      expect(html).toContain('Your code');
      expect(html).toContain('Use this code to practice:');
      // Hidden inbox preview and quiet footer.
      expect(html).toContain('Preview of the email');
      expect(html).toContain('You got this because you practice');
      expect(html).toContain(`href="https://notefinder.test/${locale}/terms"`);
      // Terms label in the email's own language (web: footer.terms).
      expect(html).toContain(
        locale === 'pt-BR' ? 'Termos de uso' : 'Terms of use',
      );
      expect(html).toContain(locale === 'pt-BR' ? '· PT' : '· EN');
    },
  );

  it('renders the code as a single letter-spaced pill', () => {
    const html = renderEmailLayout({ ...baseInput('en'), code: '482913' });

    expect(html).toContain('482913');
    expect(html).toContain('letter-spacing:8px');
  });

  it('renders the CTA as a pill linking to the page', () => {
    const html = renderEmailLayout({
      ...baseInput('pt-BR'),
      details: [],
      cta: {
        label: 'Abrir a música',
        href: 'https://notefinder.test/pt-BR/tracks/track-1?x=1&y=2',
      },
    });

    expect(html).toContain('Abrir a música');
    expect(html).toContain(
      'href="https://notefinder.test/pt-BR/tracks/track-1?x=1&amp;y=2"',
    );
  });

  it('escapes HTML in copy, code and links', () => {
    const html = renderEmailLayout({
      locale: 'en',
      preheader: 'Fish & chips <yum>',
      title: 'Hi <b>there</b>',
      intro: 'Use "this" code:',
      details: [],
      code: '<123>',
      closing: "Don't <blink>",
      cta: { label: '<go>', href: 'https://notefinder.test/?a=1&b=2' },
      footerNote: 'Fish & chips',
      termsUrl: 'https://notefinder.test/en/terms?x=1&y=2',
    });

    // The layout escapes every string, so the markup carries the entities.
    expect(html).toContain('Fish &amp; chips &lt;yum&gt;');
    expect(html).toContain('Hi &lt;b&gt;there&lt;/b&gt;');
    expect(html).toContain('&quot;this&quot;');
    expect(html).toContain('&lt;123&gt;');
    expect(html).toContain('Don&#39;t &lt;blink&gt;');
    expect(html).toContain('&lt;go&gt;');
    expect(html).toContain('?a=1&amp;b=2');
    expect(html).toContain(
      'href="https://notefinder.test/en/terms?x=1&amp;y=2"',
    );
    expect(html).not.toContain('<b>there</b>');
  });
});

describe('buildTermsUrl', () => {
  it('derives the site from a page URL the email already carries', () => {
    expect(
      buildTermsUrl('https://notefinder.test/pt-BR/tracks/track-1', 'pt-BR'),
    ).toBe('https://notefinder.test/pt-BR/terms');
    expect(buildTermsUrl('https://notefinder.test/en', 'en')).toBe(
      'https://notefinder.test/en/terms',
    );
  });

  it('accepts the bare site base the auth emails carry', () => {
    expect(buildTermsUrl('http://localhost:3000', 'en')).toBe(
      'http://localhost:3000/en/terms',
    );
  });
});
