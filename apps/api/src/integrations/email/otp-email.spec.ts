import { emailMessageSchema } from './email.job.js';
import { EMAIL_LOCALES } from './email-locale.js';
import { type OtpEmailType, renderOtpEmail } from './otp-email.js';

const TYPES: OtpEmailType[] = ['email-verification', 'forget-password'];

describe('renderOtpEmail', () => {
  it.each(
    EMAIL_LOCALES.flatMap((locale) => TYPES.map((type) => [locale, type])),
  )('renders a valid %s %s email with the code', (locale, type) => {
    const message = renderOtpEmail({
      to: 'ana@example.com',
      type: type as OtpEmailType,
      otp: '482913',
      locale: locale as (typeof EMAIL_LOCALES)[number],
      expiresInMinutes: 10,
      webUrl: 'https://vozzify.test',
    });

    expect(emailMessageSchema.parse(message)).toEqual(message);
    expect(message.to).toBe('ana@example.com');
    expect(message.text).toContain('482913');
    expect(message.html).toContain('482913');
    expect(message.text).toContain('10');
    expect(message.html).toContain(`lang="${locale}"`);
  });

  it('writes each locale in its language', () => {
    const input = {
      to: 'ana@example.com',
      type: 'email-verification',
      otp: '123456',
      expiresInMinutes: 10,
      webUrl: 'https://vozzify.test',
    } as const;

    expect(renderOtpEmail({ ...input, locale: 'en' })).toMatchObject({
      subject: 'Your vozzify verification code',
      text: expect.stringContaining('The code expires in 10 minutes.'),
    });
    expect(renderOtpEmail({ ...input, locale: 'pt-BR' })).toMatchObject({
      subject: 'Seu código de verificação do vozzify',
      text: expect.stringContaining('O código expira em 10 minutos.'),
    });
  });

  it('uses a different subject per email type', () => {
    const subjects = TYPES.map(
      (type) =>
        renderOtpEmail({
          to: 'ana@example.com',
          type,
          otp: '123456',
          locale: 'en',
          expiresInMinutes: 10,
          webUrl: 'https://vozzify.test',
        }).subject,
    );
    expect(new Set(subjects).size).toBe(TYPES.length);
  });

  it('escapes HTML in the copy', () => {
    const message = renderOtpEmail({
      to: 'ana@example.com',
      type: 'email-verification',
      otp: '123456',
      locale: 'en',
      expiresInMinutes: 10,
      webUrl: 'https://vozzify.test',
    });
    // "didn't" in the English copy.
    expect(message.html).toContain('didn&#39;t');
  });

  it('puts the code inside the pill in the body, not only in the preheader', () => {
    const { html } = renderOtpEmail({
      to: 'ana@example.com',
      type: 'email-verification',
      otp: '482913',
      locale: 'en',
      expiresInMinutes: 10,
      webUrl: 'https://vozzify.test',
    });

    expect(html).toMatch(
      /<div style="[^"]*border-radius:999px[^"]*">482913<\/div>/,
    );
  });

  it('draws the pill with plain px values, not calc()', () => {
    const { html } = renderOtpEmail({
      to: 'ana@example.com',
      type: 'email-verification',
      otp: '482913',
      locale: 'en',
      expiresInMinutes: 10,
      webUrl: 'https://vozzify.test',
    });

    expect(html).not.toContain('calc(');
  });
});
