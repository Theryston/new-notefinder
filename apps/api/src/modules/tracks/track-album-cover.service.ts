import { Injectable } from '@nestjs/common';
import { CoverArtClient } from '../../integrations/cover-art/cover-art.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { COVER_CONTENT_TYPE, toStoredCover } from './track-cover-image.js';

/** The key an Album's cover is stored under; one per Album. */
const albumCoverKey = (albumId: string): string =>
  `album-covers/${albumId}.webp`;

/**
 * Stores an Album's front cover in our storage (ADR 0003): the release group's
 * cover from the Cover Art Archive, re-encoded like a Track's cover. An Album
 * with no cover answers nothing, and the page keeps its placeholder.
 */
@Injectable()
export class TrackAlbumCoverService {
  constructor(
    private readonly coverArt: CoverArtClient,
    private readonly storage: StorageService,
  ) {}

  /**
   * The public URL of the stored cover, or undefined when the archive has no
   * cover for the Album (or it is not an image).
   */
  async storeCover(
    albumId: string,
    coverArtUrl: string,
  ): Promise<string | undefined> {
    const image = await this.coverArt.fetchImage(coverArtUrl);
    if (image === undefined) {
      return undefined;
    }
    const body = await toStoredCover(image.bytes);
    if (body === undefined) {
      return undefined;
    }
    const key = albumCoverKey(albumId);
    await this.storage.putPublicObject({
      key,
      body,
      contentType: COVER_CONTENT_TYPE,
    });
    return this.storage.publicUrl(key);
  }
}
