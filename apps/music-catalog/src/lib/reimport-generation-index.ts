import type { IndexSettings } from '../integrations/meilisearch/meilisearch-index.js';

/** A private Meilisearch document that identifies the catalog database. */
export type ReimportGenerationDocument = {
  id: 'catalog';
  databaseOid: string;
};

export const REIMPORT_GENERATION_INDEX = {
  uid: 'recordings_generation',
  primaryKey: 'id',
} as const satisfies {
  uid: string;
  primaryKey: keyof ReimportGenerationDocument;
};

export const REIMPORT_GENERATION_NEXT_INDEX = {
  uid: 'recordings_generation_next',
  primaryKey: 'id',
} as const satisfies {
  uid: string;
  primaryKey: keyof ReimportGenerationDocument;
};

export const REIMPORT_GENERATION_INDEX_SETTINGS: IndexSettings = {
  searchableAttributes: [],
  pagination: { maxTotalHits: 1 },
};
