import type { MusicCatalogErrorCode } from '@notefinder/contracts';
import { CatalogError } from './catalog-error.js';

/** The protocol's two codes for one kind of entity, and its name for messages. */
export type EntityErrorCodes = {
  label: string;
  notFound: MusicCatalogErrorCode;
  moved: MusicCatalogErrorCode;
};

/**
 * The error for an MBID the catalog does not serve as the entity asked for:
 * MusicBrainz merged it into another entity (answered with the new MBID, the
 * same pattern as ADR 0001), or it does not know it at all.
 */
export const missingEntityError = (
  codes: EntityErrorCodes,
  mbid: string,
  newMbid: string | undefined,
): CatalogError =>
  newMbid === undefined
    ? new CatalogError(codes.notFound, `No ${codes.label} has the MBID ${mbid}`)
    : new CatalogError(
        codes.moved,
        `The ${codes.label} ${mbid} was merged into ${newMbid}`,
        { newMbid },
      );
