import {
  compileMjml,
  emailButton,
  emailParagraph,
  renderEmailLayout,
} from './email-layout.js';
import { EMAIL_LAYOUT_MJML } from './email-layout-skeleton.js';

const webUrl = 'https://notefinder.test';

const layoutInput = {
  webUrl,
  locale: 'en',
  subject: 'Subject',
  preheader: 'Preheader',
  overline: 'Overline',
  title: 'Title',
  body: emailParagraph('Body'),
  reason: 'Why you got this',
} as const;

describe('compileMjml', () => {
  it('rejects a layout that MJML reports errors for', async () => {
    await expect(
      compileMjml('<mjml><mj-body><mj-unknown-tag /></mj-body></mjml>'),
    ).rejects.toThrow('MJML email layout does not compile');
  });

  it('compiles the shipped layout without MJML errors', async () => {
    await expect(compileMjml(EMAIL_LAYOUT_MJML)).resolves.toContain(
      '<html lang="NFSLOT_LANG">',
    );
  });
});

describe('renderEmailLayout', () => {
  it('writes the locale on the root <html> tag only', () => {
    const html = renderEmailLayout({ ...layoutInput, locale: 'pt-BR' });

    expect(html.match(/<html[^>]*>/g)).toEqual(['<html lang="pt-BR">']);
  });

  it('leaves no slot unfilled and no VML or XML namespace behind', () => {
    const html = renderEmailLayout(layoutInput);

    expect(html).not.toMatch(/NFSLOT_/);
    expect(html).not.toMatch(/<v:/);
    expect(html).not.toContain('xmlns');
  });

  it('places the preheader, overline and title in the layout', () => {
    const html = renderEmailLayout(layoutInput);

    expect(html).toContain('Preheader');
    expect(html).toContain('>Overline<');
    expect(html).toContain('>Title<');
    expect(html).toContain('<title>Subject</title>');
  });

  it('escapes every text slot', () => {
    const html = renderEmailLayout({
      ...layoutInput,
      title: '<script>x</script>',
      reason: 'Tom & "Jerry"',
    });

    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('Tom &amp; &quot;Jerry&quot;');
  });

  it('does not fill slots found inside user content', () => {
    const html = renderEmailLayout({
      ...layoutInput,
      title: 'NFSLOT_BODY',
      body: emailParagraph('Real body'),
    });

    expect(html).toContain('>NFSLOT_BODY<');
    expect(html).toContain('Real body');
  });

  it('links the Terms page and the other language on the injected web origin', () => {
    const html = renderEmailLayout(layoutInput);

    expect(html).toContain(`href="${webUrl}/en/terms"`);
    expect(html).toContain(`href="${webUrl}/pt-BR"`);
  });

  it('links the Terms page of the email locale', () => {
    const html = renderEmailLayout({ ...layoutInput, locale: 'pt-BR' });

    expect(html).toContain(`href="${webUrl}/pt-BR/terms"`);
    expect(html).toContain(`href="${webUrl}/en"`);
  });

  it('imports Figtree and Geist Mono in the head, and never Roboto', () => {
    const html = renderEmailLayout(layoutInput);

    expect(html).toContain('family=Figtree');
    expect(html).toContain('family=Geist+Mono');
    expect(html).not.toContain('Roboto');
  });

  it('shows the logo as an image of the web icon, without an SVG', () => {
    const html = renderEmailLayout(layoutInput);

    expect(html).toContain(`src="${webUrl}/apple-icon.png"`);
    expect(html).toMatch(/<img [^>]*alt="" /);
    expect(html).not.toContain('<svg');
  });

  it('writes the footer links in the other locale names', () => {
    const en = renderEmailLayout(layoutInput);
    const ptBr = renderEmailLayout({ ...layoutInput, locale: 'pt-BR' });

    expect(en).toContain('Terms of use');
    expect(en).toContain('Ler em português');
    expect(ptBr).toContain('Termos de uso');
    expect(ptBr).toContain('Read in English');
  });
});

describe('emailButton', () => {
  it('escapes the href and the label', () => {
    const button = emailButton('https://notefinder.test/a?x=1&y=2', 'Go & see');

    expect(button).toContain('href="https://notefinder.test/a?x=1&amp;y=2"');
    expect(button).toContain('>Go &amp; see</a>');
  });
});
