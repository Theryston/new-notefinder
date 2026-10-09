import { Inject, Injectable } from '@nestjs/common';
import { Innertube } from 'youtubei.js';
import { ENV, type Env } from '../../config/env.js';
import { brightDataProxyOf, createProxiedFetch } from './bright-data-proxy.js';
import {
  type YouTubeSearchItemLike,
  type YouTubeVideo,
  youtubeVideoOfInfo,
  youtubeVideoOfSearchItem,
} from './youtube-video.js';

/**
 * The YouTube Music requests Processing makes: a song search and the basic
 * info of one video. The only code that imports `youtubei.js`; features depend
 * on this class, so tests replace it at this boundary. The session is opened
 * on first use, so booting the API makes no request.
 */
@Injectable()
export class YouTubeMusicClient {
  private session: Promise<Innertube> | undefined;
  private readonly fetchImplementation: typeof fetch;

  constructor(@Inject(ENV) env: Env) {
    const proxy = brightDataProxyOf(env);
    this.fetchImplementation =
      proxy === undefined ? fetch : createProxiedFetch(proxy);
  }

  /**
   * The songs and videos a search for the text finds, songs first, most
   * relevant first. Each kind is its own typed search: the untyped one answers
   * a mixed list with no "songs" and "videos" shelves and no length on songs,
   * which a match by duration cannot use.
   */
  async searchSongs(query: string): Promise<YouTubeVideo[]> {
    const yt = await this.innertube();
    const [songs, videos] = await Promise.all([
      yt.music.search(query, { type: 'song' }),
      yt.music.search(query, { type: 'video' }),
    ]);
    return [...itemsOf(songs.songs), ...itemsOf(videos.videos)].flatMap(
      (item) => youtubeVideoOfSearchItem(item) ?? [],
    );
  }

  /**
   * The video with this ID, or undefined when YouTube has no title for it. An
   * unavailable video makes the request fail, which the caller treats as no
   * video.
   */
  async getVideo(videoId: string): Promise<YouTubeVideo | undefined> {
    const yt = await this.innertube();
    const info = await yt.music.getInfo(videoId);
    return youtubeVideoOfInfo(videoId, info.basic_info);
  }

  private innertube(): Promise<Innertube> {
    this.session ??= Innertube.create({
      retrieve_player: false,
      fetch: this.fetchImplementation,
    }).catch((error: unknown) => {
      // A failed session is retried on the next request, not kept.
      this.session = undefined;
      throw error;
    });
    return this.session;
  }
}

/** The result items of one shelf of a search; none when the shelf is missing. */
const itemsOf = (
  shelf: { contents?: readonly YouTubeSearchItemLike[] } | undefined,
): readonly YouTubeSearchItemLike[] => shelf?.contents ?? [];
