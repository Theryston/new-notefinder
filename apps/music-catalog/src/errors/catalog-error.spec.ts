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

describe('CatalogError newMbid', () => {
  it('carries the MBID a Recording was merged into', () => {
    const error = new CatalogError('RECORDING_MOVED', 'Merged', {
      newMbid: '00000000-0000-4000-8000-000000000100',
    });

    expect(error.newMbid).toBe('00000000-0000-4000-8000-000000000100');
  });

  it('has none unless told', () => {
    expect(new CatalogError('INTERNAL', 'Broken').newMbid).toBeUndefined();
  });
});
