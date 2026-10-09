import { Injectable } from '@nestjs/common';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { TracksRepository } from './tracks.repository.js';

/**
 * The Lyrics that guide a Track's transcription: the plain Lyrics the Music
 * catalog has for the Track's Recording (CONTEXT.md "Lyrics").
 */
@Injectable()
export class TrackLyricsPromptService {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly catalog: MusicCatalogClient,
  ) {}

  /**
   * The plain Lyrics of the Recording, or null when the catalog has none. A
   * Recording the catalog merged into another is not followed: the Lyrics of
   * the merged one are not known to be this Track's. A failed lookup throws, so
   * the step is retried.
   */
  async lyricsOf(trackId: string): Promise<string | null> {
    const recordingMbid = await this.tracks.findRecordingMbid(trackId);
    if (recordingMbid === undefined) {
      throw new Error(`Track ${trackId} disappeared during its Processing`);
    }
    const lookup = await this.catalog.getRecording(recordingMbid);
    return lookup.status === 'found' ? lookup.recording.lyrics.plain : null;
  }
}
