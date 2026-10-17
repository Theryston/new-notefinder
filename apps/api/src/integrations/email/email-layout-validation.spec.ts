import { renderEmailLayout } from './email-layout.js';

// A broken skeleton must fail loudly instead of shipping broken markup.
vi.mock('mjml', () => ({
  default: () => ({
    html: '<html lang="en"><body>broken</body></html>',
    errors: [{ message: "Element mj-bogus doesn't exist" }],
  }),
}));

describe('renderEmailLayout validation', () => {
  it('throws when mjml reports validation errors', () => {
    expect(() =>
      renderEmailLayout({
        locale: 'en',
        preheader: 'Preview',
        title: 'Title',
        intro: 'Intro',
        details: [],
        footerNote: 'Footer note',
      }),
    ).toThrow('Invalid email MJML');
  });
});
