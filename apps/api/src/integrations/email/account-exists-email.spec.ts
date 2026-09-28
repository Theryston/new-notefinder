import { renderAccountExistsEmail } from './account-exists-email.js';
import { emailMessageSchema } from './email.job.js';
import { EMAIL_LOCALES } from './email-locale.js';

describe('renderAccountExistsEmail', () => {
  it.each(EMAIL_LOCALES)('renders a valid %s email', (locale) => {
    const message = renderAccountExistsEmail({ to: 'ana@example.com', locale });

    expect(emailMessageSchema.parse(message)).toEqual(message);
    expect(message.to).toBe('ana@example.com');
    expect(message.html).toContain(`lang="${locale}"`);
  });

  it('writes each locale in its language', () => {
    const to = 'ana@example.com';
    expect(renderAccountExistsEmail({ to, locale: 'en' })).toMatchObject({
      subject: 'You already have a notefinder account',
      text: expect.stringContaining('Forgot password'),
    });
    expect(renderAccountExistsEmail({ to, locale: 'pt-BR' })).toMatchObject({
      subject: 'Você já tem uma conta no notefinder',
      text: expect.stringContaining('Esqueci minha senha'),
    });
  });

  it('escapes HTML in the copy', () => {
    const { html } = renderAccountExistsEmail({
      to: 'ana@example.com',
      locale: 'en',
    });
    expect(html).toContain('&quot;Forgot password&quot;');
    expect(html).not.toContain('"Forgot password"');
  });
});
