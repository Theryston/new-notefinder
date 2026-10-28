import { renderAccountExistsEmail } from './account-exists-email.js';
import { emailMessageSchema } from './email.job.js';
import { EMAIL_LOCALES } from './email-locale.js';

describe('renderAccountExistsEmail', () => {
  it.each(EMAIL_LOCALES)('renders a valid %s email', (locale) => {
    const message = renderAccountExistsEmail({
      to: 'ana@example.com',
      locale,
      webUrl: 'https://vozzify.test',
    });

    expect(emailMessageSchema.parse(message)).toEqual(message);
    expect(message.to).toBe('ana@example.com');
    expect(message.html).toContain(`lang="${locale}"`);
  });

  it('writes each locale in its language', () => {
    const to = 'ana@example.com';
    const webUrl = 'https://vozzify.test';
    expect(
      renderAccountExistsEmail({ to, locale: 'en', webUrl }),
    ).toMatchObject({
      subject: 'You already have a vozzify account',
      text: expect.stringContaining('Forgot password'),
    });
    expect(
      renderAccountExistsEmail({ to, locale: 'pt-BR', webUrl }),
    ).toMatchObject({
      subject: 'Você já tem uma conta no vozzify',
      text: expect.stringContaining('Esqueci minha senha'),
    });
  });

  it('escapes HTML in the copy', () => {
    const { html } = renderAccountExistsEmail({
      to: 'ana@example.com',
      locale: 'en',
      webUrl: 'https://vozzify.test',
    });
    expect(html).toContain('&quot;Forgot password&quot;');
    expect(html).not.toContain('"Forgot password"');
  });
});
