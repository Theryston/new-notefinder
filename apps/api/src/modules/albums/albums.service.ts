import { Injectable } from '@nestjs/common';
import type {
  Album,
  ListTracksQuery,
  TrackSummaryPage,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { TracksService } from '../tracks/tracks.service.js';
import { type AlbumRow, AlbumsRepository } from './albums.repository.js';

@Injectable()
export class AlbumsService {
  constructor(
    private readonly albumsRepository: AlbumsRepository,
    private readonly tracksService: TracksService,
  ) {}

  async getAlbum(albumId: string): Promise<Album> {
    const [album, trackCount] = await Promise.all([
      this.requireAlbum(albumId),
      this.tracksService.countCompleted({ albumId }),
    ]);
    return { ...album, trackCount };
  }

  /** The album's tracks with notes, most popular first. */
  async listTracks(
    albumId: string,
    query: ListTracksQuery,
  ): Promise<TrackSummaryPage> {
    await this.requireAlbum(albumId);
    return this.tracksService.listCompleted({ albumId }, query);
  }

  private async requireAlbum(albumId: string): Promise<AlbumRow> {
    const album = await this.albumsRepository.findById(albumId);
    if (!album) {
      throw new AppException('NOT_FOUND', 'Album not found');
    }
    return album;
  }
}
