import { signUpLocale } from './sign-up-locale.js';

describe('signUpLocale', () => {
  it('takes the language of the sign-up request', () => {
    const context = {
      headers: new Headers({ 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' }),
    };

    expect(signUpLocale(context)).toBe('pt-BR');
  });

  it('reads the headers of the request when the hook context has none', () => {
    const context = {
      request: { headers: new Headers({ 'accept-language': 'pt-PT' }) },
    };

    expect(signUpLocale(context)).toBe('pt-BR');
  });

  it('is English when the request names no supported language', () => {
    expect(
      signUpLocale({ headers: new Headers({ 'accept-language': 'fr-FR' }) }),
    ).toBe('en');
  });

  it('is English without any request', () => {
    expect(signUpLocale(null)).toBe('en');
  });
});
