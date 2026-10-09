import type { DownloadedImage } from '../../src/integrations/cover-art/cover-art.client.js';

/**
 * The Cover Art Archive and image downloads, faked at their integration
 * boundary: a release or URL answers the image set for it, or none (a 404).
 * Every request is recorded.
 */
export class FakeCoverArt {
  /** The front cover per release MBID. */
  releaseCovers = new Map<string, DownloadedImage>();
  /** The image per URL (a YouTube Music artwork). */
  images = new Map<string, DownloadedImage>();
  /** When set, every release cover request fails with it: the archive is down. */
  releaseFailure: Error | undefined;
  /** When set, every image download fails with it: a 5xx or a timeout from the archive. */
  imageFailure: Error | undefined;
  readonly releaseRequests: string[] = [];
  readonly imageRequests: string[] = [];

  /** Back to a fresh fake: no covers, no failure, no calls recorded. */
  reset(): void {
    this.releaseCovers = new Map();
    this.images = new Map();
    this.releaseFailure = undefined;
    this.imageFailure = undefined;
    this.releaseRequests.length = 0;
    this.imageRequests.length = 0;
  }

  async fetchReleaseFrontCover(
    releaseMbid: string,
  ): Promise<DownloadedImage | undefined> {
    this.releaseRequests.push(releaseMbid);
    if (this.releaseFailure !== undefined) {
      throw this.releaseFailure;
    }
    return this.releaseCovers.get(releaseMbid);
  }

  async fetchImage(url: string): Promise<DownloadedImage | undefined> {
    this.imageRequests.push(url);
    if (this.imageFailure !== undefined) {
      throw this.imageFailure;
    }
    return this.images.get(url);
  }
}
