import { Injectable } from '@nestjs/common';
import type {
  Artist,
  ListTracksQuery,
  TrackSummaryPage,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { TracksService } from '../tracks/tracks.service.js';
import { type ArtistRow, ArtistsRepository } from './artists.repository.js';

@Injectable()
export class ArtistsService {
  constructor(
    private readonly artistsRepository: ArtistsRepository,
    private readonly tracksService: TracksService,
  ) {}

  async getArtist(artistId: string): Promise<Artist> {
    const [artist, trackCount] = await Promise.all([
      this.requireArtist(artistId),
      this.tracksService.countCompleted({ artistId }),
    ]);
    return { ...artist, trackCount };
  }

  /** The artist's tracks with notes, most popular first. */
  async listTracks(
    artistId: string,
    query: ListTracksQuery,
  ): Promise<TrackSummaryPage> {
    await this.requireArtist(artistId);
    return this.tracksService.listCompleted({ artistId }, query);
  }

  private async requireArtist(artistId: string): Promise<ArtistRow> {
    const artist = await this.artistsRepository.findById(artistId);
    if (!artist) {
      throw new AppException('NOT_FOUND', 'Artist not found');
    }
    return artist;
  }
}
