import type {
  MusicCatalogTrackAssociationPayload,
  MusicCatalogTrackAssociationResult,
} from '@vozzify/contracts';
import type { Database } from '../../database/database.js';
import { CatalogError } from '../../errors/catalog-error.js';
import type { TrackAssociationRepository } from './track-association.repository.js';

export class TrackAssociationService {
  constructor(private readonly repository: TrackAssociationRepository) {}

  async associate(
    payload: MusicCatalogTrackAssociationPayload,
  ): Promise<MusicCatalogTrackAssociationResult> {
    const accepted = await this.repository.put(payload);
    if (!accepted) {
      throw new CatalogError(
        'REIMPORT_SWITCHING',
        'Track association delivery must be retried after reimport cutover.',
      );
    }
    return {};
  }

  peekPending(limit: number, afterMbid?: string): Promise<string[]> {
    return this.repository.peekPending(limit, afterMbid);
  }

  markIndexed(mbids: readonly string[]): Promise<void> {
    return this.repository.markIndexed(mbids);
  }

  transferTo(nextCopy: Database, batchSize: number): Promise<void> {
    return this.repository.transferTo(nextCopy, batchSize);
  }
}
