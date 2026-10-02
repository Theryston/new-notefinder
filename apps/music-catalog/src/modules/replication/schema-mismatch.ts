/**
 * Whether an `mbslave sync` failure is MusicBrainz's yearly schema change:
 * the binary exits non-zero with a schema mismatch once the database was
 * built by an older schema than the binary expects. Matched loosely on
 * purpose: mbslave phrases it per command, but always around "schema".
 */
const SCHEMA_MISMATCH =
  /mismatched schema|schema mismatch|schema.+mismatch|wrong schema|unexpected schema/i;

export const isSchemaMismatchError = (error: unknown): boolean =>
  error instanceof Error && SCHEMA_MISMATCH.test(error.message);
