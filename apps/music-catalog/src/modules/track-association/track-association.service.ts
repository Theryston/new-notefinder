import type {
  MusicCatalogTrackAssociationPayload,
  MusicCatalogTrackAssociationResult,
} from '@notefinder/contracts';
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
}
