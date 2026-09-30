import { createStatusHandler } from './bootstrap.handler.js';
import type { BootstrapService } from './bootstrap.service.js';

const setup = () => {
  const service = {
    getStatus: vi.fn(async () => ({
      phase: 'indexing' as const,
      dataset: 'full' as const,
    })),
  };
  const handler = createStatusHandler(service as unknown as BootstrapService);
  return { handler, service };
};

describe('createStatusHandler', () => {
  it('answers the status request type', () => {
    expect(setup().handler.type).toBe('status');
  });

  it.each([
    ['no payload', undefined],
    ['an empty payload', {}],
    ['a payload with fields it ignores', { verbose: true }],
  ])('returns the status for %s', async (_label, payload) => {
    const { handler } = setup();

    await expect(handler.handle(payload)).resolves.toEqual({
      phase: 'indexing',
      dataset: 'full',
    });
  });

  it.each([
    ['null', null],
    ['a string', 'status'],
    ['a number', 1],
    ['an array', []],
  ])('refuses %s as the payload', async (_label, payload) => {
    const { handler, service } = setup();

    await expect(handler.handle(payload)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(service.getStatus).not.toHaveBeenCalled();
  });
});
