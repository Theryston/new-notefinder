import { CatalogError } from './catalog-error.js';

describe('CatalogError', () => {
  it('is an Error that carries the protocol code', () => {
    const error = new CatalogError('CATALOG_NOT_READY', 'Still importing');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CatalogError');
    expect(error.code).toBe('CATALOG_NOT_READY');
    expect(error.message).toBe('Still importing');
  });
});
