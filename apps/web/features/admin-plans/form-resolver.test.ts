import { describe, expect, it } from 'vitest';
import { planFormDefaults } from './form';
import { planFormResolver } from './form-resolver';

const options = { fields: {}, shouldUseNativeValidation: false };

describe('Localized plan form validation', () => {
  it('reports missing translations through field errors', async () => {
    const result = await planFormResolver(planFormDefaults(), {}, options);
    expect(result.errors).toHaveProperty('copy');
    expect(result.values).toEqual({});
  });
  it('validates publication prices using the API contract', async () => {
    const input = planFormDefaults();
    input.copy = {
      en: { name: 'Studio', description: 'Tools.' },
      'pt-BR': { name: 'Studio BR', description: 'Localized tools.' },
    };
    input.published = true;
    expect((await planFormResolver(input, {}, options)).errors).toHaveProperty(
      'prices',
    );
    input.published = false;
    expect(await planFormResolver(input, {}, options)).toEqual({
      errors: {},
      values: input,
    });
  });
});
