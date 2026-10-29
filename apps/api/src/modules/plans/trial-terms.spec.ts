import { isAgreedTrial } from './trial-terms.js';

describe('Confirmed trial terms', () => {
  const provider = {
    trial_start: 100,
    trial_end: 100 + 14 * 86400,
    default_payment_method: 'pm_card',
  };
  it('requires the promised duration and a card', () => {
    expect(isAgreedTrial(14, provider)).toBe(true);
    expect(isAgreedTrial(7, provider)).toBe(false);
    expect(
      isAgreedTrial(14, {
        ...provider,
        default_payment_method: null,
      }),
    ).toBe(false);
  });
});
