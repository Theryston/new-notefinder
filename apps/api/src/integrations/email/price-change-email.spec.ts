import { renderPriceChangeEmail } from './price-change-email.js';

describe('price-change email', () => {
  it('explains the old and new amounts, effective renewal and management link in the subscriber language', () => {
    const message = renderPriceChangeEmail({
      to: 'singer@example.com',
      locale: 'pt-BR',
      webUrl: 'https://vozzify.test',
      currency: 'BRL',
      oldAmount: 1990,
      newAmount: 2490,
      effectiveAt: new Date('2026-12-01T12:00:00Z'),
    });
    expect(message.html).toContain('lang="pt-BR"');
    expect(message.text).toContain('19,90');
    expect(message.text).toContain('24,90');
    expect(message.text).toContain('01/12/2026');
    expect(message.text).toContain('https://vozzify.test/pt-BR/subscription');
  });
});
