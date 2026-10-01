import type { CatalogDataset } from '@notefinder/contracts';

export type ReplicationTokenOptions = {
  /** Which MusicBrainz data this deployment runs (`CATALOG_DATASET`). */
  dataset: CatalogDataset;
  /** `MBSLAVE_MUSICBRAINZ_TOKEN`, the MetaBrainz access token itself. */
  token?: string;
  /** `MBSLAVE_MUSICBRAINZ_TOKEN_FILE`, a file holding the token. */
  tokenFile?: string;
};

/**
 * Fails fast when `full` mode would replicate without a MetaBrainz access
 * token: without one the first `mbslave sync` answers 403 and the container
 * crash-loops on mbslave's message instead of ours. `sample` mode needs no
 * token (the dump download needs none, and replication stays off there), so
 * it always passes.
 */
export const assertReplicationToken = (
  options: ReplicationTokenOptions,
): void => {
  if (options.dataset !== 'full') {
    return;
  }
  // Non-empty: the compose file passes both variables through with an empty
  // default when unset, and an empty file path would make mbslave itself
  // crash trying to open it.
  if (options.token || options.tokenFile) {
    return;
  }
  throw new Error(
    'MusicBrainz replication needs a MetaBrainz access token in full mode: ' +
      'set MBSLAVE_MUSICBRAINZ_TOKEN (or MBSLAVE_MUSICBRAINZ_TOKEN_FILE) ' +
      'to the 40-character token from the MetaBrainz profile page ' +
      '(free for non-commercial use; see apps/music-catalog/AGENTS.md).',
  );
};
