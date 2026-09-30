import type { Recording } from '@notefinder/contracts';
import { CatalogError } from '../../errors/catalog-error.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import { assembleRecording } from './assemble-recording.js';
import type { RecordingRepository } from './recording.repository.js';
import type { RecordingDetails, RecordingRow } from './recording-data.js';

export class RecordingService {
  constructor(
    private readonly repository: RecordingRepository,
    private readonly bootstrap: BootstrapService,
  ) {}

  /**
   * Everything the catalog knows about one Recording, addressed by MBID.
   * `CATALOG_NOT_READY` until the first import finishes; `RECORDING_MOVED`
   * (with the new MBID) for an MBID MusicBrainz merged into another
   * Recording; `RECORDING_NOT_FOUND` for one it does not know or deleted.
   */
  async getRecording(mbid: string): Promise<Recording> {
    await this.bootstrap.assertReady();
    const row = await this.repository.findByMbid(mbid);
    if (row === undefined) {
      throw await this.whyMissing(mbid);
    }
    return assembleRecording(row, await this.loadDetails(row));
  }

  private async whyMissing(mbid: string): Promise<CatalogError> {
    const newMbid = await this.repository.findMergedInto(mbid);
    if (newMbid === undefined) {
      return new CatalogError(
        'RECORDING_NOT_FOUND',
        `No Recording has the MBID ${mbid}`,
      );
    }
    return new CatalogError(
      'RECORDING_MOVED',
      `The Recording ${mbid} was merged into ${newMbid}`,
      { newMbid },
    );
  }

  // Releases come first because their events depend on them; the rest is
  // independent and read in parallel.
  private async loadDetails(row: RecordingRow): Promise<RecordingDetails> {
    const [artists, isrcs, releases, works, externalUrls, tagLevels] =
      await Promise.all([
        this.repository.findCreditedArtists(row.artistCreditId),
        this.repository.findIsrcs(row.id),
        this.repository.findReleases(row.id),
        this.repository.findWorks(row.id),
        this.repository.findExternalUrls(row.id),
        this.repository.findTagLevels({
          recordingId: row.id,
          artistCreditId: row.artistCreditId,
        }),
      ]);
    const releaseEvents = await this.repository.findReleaseEvents(
      releases.map((release) => release.id),
    );
    return {
      artists,
      isrcs,
      releases,
      releaseEvents,
      works,
      externalUrls,
      tagLevels,
    };
  }
}
