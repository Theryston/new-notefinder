import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type Mbid,
  type MusicCatalogArtist,
  type MusicCatalogError,
  type MusicCatalogErrorCode,
  type MusicCatalogReleaseGroup,
  type MusicCatalogResponse,
  type MusicCatalogSearchParams,
  type MusicCatalogSearchResult,
  musicCatalogGetArtistResponseSchema,
  musicCatalogGetRecordingResponseSchema,
  musicCatalogGetReleaseGroupResponseSchema,
  musicCatalogSearchResponseSchema,
  type Recording,
} from '@notefinder/contracts';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception.js';
import { ENV, type Env } from '../../config/env.js';
import { MusicCatalogConnection } from './music-catalog.connection.js';

/**
 * What the catalog answers for one Recording. `moved` carries the MBID the
 * Recording was merged into, which the caller should follow.
 */
export type CatalogRecordingLookup =
  | { status: 'found'; recording: Recording }
  | { status: 'not-found' }
  | { status: 'moved'; newMbid: Mbid };

/** What the catalog answers for one release group (an Album). */
export type CatalogReleaseGroupLookup =
  | { status: 'found'; releaseGroup: MusicCatalogReleaseGroup }
  | { status: 'not-found' }
  | { status: 'moved'; newMbid: Mbid };

/** What the catalog answers for one artist. */
export type CatalogArtistLookup =
  | { status: 'found'; artist: MusicCatalogArtist }
  | { status: 'not-found' }
  | { status: 'moved'; newMbid: Mbid };

/** The answer to a lookup by MBID, whatever the entity is. */
type LookupAnswer<TEntity> =
  | { status: 'found'; entity: TEntity }
  | { status: 'not-found' }
  | { status: 'moved'; newMbid: Mbid };

/** The error codes that mean "not known" and "merged" for one entity type. */
type LookupCodes = {
  notFound: MusicCatalogErrorCode;
  moved: MusicCatalogErrorCode;
};

const RECORDING_CODES: LookupCodes = {
  notFound: 'RECORDING_NOT_FOUND',
  moved: 'RECORDING_MOVED',
};
const RELEASE_GROUP_CODES: LookupCodes = {
  notFound: 'RELEASE_GROUP_NOT_FOUND',
  moved: 'RELEASE_GROUP_MOVED',
};
const ARTIST_CODES: LookupCodes = {
  notFound: 'ARTIST_NOT_FOUND',
  moved: 'ARTIST_MOVED',
};

/**
 * The typed operations of the Music catalog, over one persistent connection
 * (`MusicCatalogConnection`). Every answer that is not a result becomes an
 * `AppException`: a dead catalog is `SERVICE_UNAVAILABLE` (retryable) and a
 * slow one `GATEWAY_TIMEOUT`, so the web can retry instead of a dead end.
 */
@Injectable()
export class MusicCatalogClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MusicCatalogClient.name);
  private readonly connection: MusicCatalogConnection;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.connection = new MusicCatalogConnection(env);
  }

  onModuleInit(): void {
    if (!this.isConfigured()) {
      if (this.env.NODE_ENV === 'production') {
        throw new Error(
          'Invalid environment variables:\nMUSIC_CATALOG_URL: Required in production',
        );
      }
      this.logger.warn(
        'Music catalog not configured: search fails until ' +
          'MUSIC_CATALOG_URL and MUSIC_CATALOG_API_KEY are set',
      );
      return;
    }
    this.connection.start();
  }

  onModuleDestroy(): void {
    this.connection.stop();
  }

  /**
   * Searches the catalog, keeping the catalog's relevance order. Every hit
   * is returned untouched; the caller adds the Track link.
   */
  async search(
    params: MusicCatalogSearchParams,
  ): Promise<MusicCatalogSearchResult> {
    return resultOrThrow(
      await this.requestOrFail(
        'search',
        params,
        musicCatalogSearchResponseSchema,
      ),
    );
  }

  /**
   * Looks one Recording up by its MBID. A Recording the catalog does not know
   * is `not-found`, and one merged into another Recording is `moved`; both are
   * answers, not failures, so the caller decides what they mean.
   */
  async getRecording(mbid: Mbid): Promise<CatalogRecordingLookup> {
    const answer = await this.lookup(
      'getRecording',
      mbid,
      musicCatalogGetRecordingResponseSchema,
      RECORDING_CODES,
    );
    return answer.status === 'found'
      ? { status: 'found', recording: answer.entity }
      : answer;
  }

  /**
   * Looks one release group (an Album, ADR 0003) up by its MBID. Its representative
   * release and its tracks come with it; `not-found` and `moved` are answers, as
   * for a Recording.
   */
  async getReleaseGroup(mbid: Mbid): Promise<CatalogReleaseGroupLookup> {
    const answer = await this.lookup(
      'getReleaseGroup',
      mbid,
      musicCatalogGetReleaseGroupResponseSchema,
      RELEASE_GROUP_CODES,
    );
    return answer.status === 'found'
      ? { status: 'found', releaseGroup: answer.entity }
      : answer;
  }

  /** Looks one artist up by its MBID: its name and genres. */
  async getArtist(mbid: Mbid): Promise<CatalogArtistLookup> {
    const answer = await this.lookup(
      'getArtist',
      mbid,
      musicCatalogGetArtistResponseSchema,
      ARTIST_CODES,
    );
    return answer.status === 'found'
      ? { status: 'found', artist: answer.entity }
      : answer;
  }

  /**
   * One lookup by MBID: a result is `found`; the entity-specific codes are
   * `not-found` and `moved`; every other failure is thrown.
   */
  private async lookup<TEntity>(
    type: string,
    mbid: Mbid,
    responseSchema: z.ZodType<MusicCatalogResponse<TEntity>>,
    codes: LookupCodes,
  ): Promise<LookupAnswer<TEntity>> {
    const response = await this.requestOrFail(type, { mbid }, responseSchema);
    if (response.ok) {
      return { status: 'found', entity: response.result };
    }
    if (response.error.code === codes.notFound) {
      return { status: 'not-found' };
    }
    if (
      response.error.code === codes.moved &&
      response.error.newMbid !== undefined
    ) {
      return { status: 'moved', newMbid: response.error.newMbid };
    }
    throw catalogErrorOf(response.error);
  }

  private requestOrFail<TOutput>(
    type: string,
    payload: unknown,
    responseSchema: z.ZodType<TOutput>,
  ): Promise<TOutput> {
    if (!this.isConfigured()) {
      throw new AppException(
        'INTERNAL_ERROR',
        'Music catalog is not configured',
      );
    }
    return this.connection.request(type, payload, responseSchema);
  }

  private isConfigured(): boolean {
    return (
      this.env.MUSIC_CATALOG_URL !== undefined &&
      this.env.MUSIC_CATALOG_API_KEY !== undefined
    );
  }
}

/** The result of a successful answer, or the exception its error becomes. */
function resultOrThrow<TResult>(
  response:
    | { ok: true; result: TResult }
    | { ok: false; error: MusicCatalogError },
): TResult {
  if (response.ok) {
    return response.result;
  }
  throw catalogErrorOf(response.error);
}

/**
 * Maps a protocol error to the API's error. A catalog that is still starting
 * is retryable; every other error is an internal one.
 */
function catalogErrorOf(error: MusicCatalogError): AppException {
  if (error.code === 'CATALOG_NOT_READY') {
    return new AppException('SERVICE_UNAVAILABLE', error.message);
  }
  return new AppException('INTERNAL_ERROR', error.message);
}
