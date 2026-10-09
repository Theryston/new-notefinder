import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { createId } from '@paralleldrive/cuid2';
import { and, asc, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  trackLyricLines,
  trackLyricWords,
} from '../../database/schema/track-lyrics.js';
import { trackProcessings } from '../../database/schema/track-processings.js';
import type { TimedLyricLine } from './track-lyrics-lines.js';

/** The audio a Processing has stored so far; a URL is null until a step stores it. */
export type ProcessingAudioUrls = {
  musicWavUrl: string | null;
  musicMp3Url: string | null;
  vocalsWavUrl: string | null;
  vocalsMp3Url: string | null;
};

/** Which MP3 of a Processing: the music's or the vocals'. */
export type Mp3Kind = 'music' | 'vocals';

/**
 * The lyrics step's data (CONTEXT.md "Timed lyrics"): the audio URLs of a
 * Processing, its MP3 URLs, and a Track's Timed lines with their words.
 */
@Injectable()
export class TrackLyricsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** The audio URLs of a Processing; the Processing must exist. */
  async findAudioUrls(processingId: string): Promise<ProcessingAudioUrls> {
    const [row] = await this.txHost.tx
      .select({
        musicWavUrl: trackProcessings.musicWavUrl,
        musicMp3Url: trackProcessings.musicMp3Url,
        vocalsWavUrl: trackProcessings.vocalsWavUrl,
        vocalsMp3Url: trackProcessings.vocalsMp3Url,
      })
      .from(trackProcessings)
      .where(eq(trackProcessings.id, processingId))
      .limit(1);
    if (row === undefined) {
      throw new Error(`Processing ${processingId} does not exist`);
    }
    return row;
  }

  /**
   * Saves the public URL of an MP3 the lyrics step stored. The file belongs to
   * this Processing alone, so the URL is saved whatever state the row is in.
   */
  async saveMp3Url(
    processingId: string,
    kind: Mp3Kind,
    url: string,
  ): Promise<void> {
    await this.txHost.tx
      .update(trackProcessings)
      .set(kind === 'music' ? { musicMp3Url: url } : { vocalsMp3Url: url })
      .where(eq(trackProcessings.id, processingId));
  }

  /**
   * Replaces the Track's Timed lyrics with these, in the caller's transaction.
   * The Processing's row is locked while it is in the lyrics step: a job that
   * ran late finds it moved on, and nothing changes (false).
   */
  async replaceTimedLyrics(
    processingId: string,
    trackId: string,
    lines: readonly TimedLyricLine[],
  ): Promise<boolean> {
    const locked = await this.txHost.tx
      .select({ id: trackProcessings.id })
      .from(trackProcessings)
      .where(
        and(
          eq(trackProcessings.id, processingId),
          eq(trackProcessings.status, 'EXTRACTING_LYRICS'),
        ),
      )
      .for('update');
    if (locked.length === 0) {
      return false;
    }
    // The lines' words go with them: the words reference their line.
    await this.txHost.tx
      .delete(trackLyricLines)
      .where(eq(trackLyricLines.trackId, trackId));
    const built = lines.map((line, position) => ({
      id: createId(),
      line,
      position,
    }));
    if (built.length === 0) {
      return true;
    }
    await this.txHost.tx.insert(trackLyricLines).values(
      built.map(({ id, line, position }) => ({
        id,
        trackId,
        position,
        start: line.start,
        end: line.end,
      })),
    );
    await this.txHost.tx.insert(trackLyricWords).values(
      built.flatMap(({ id, line }) =>
        line.words.map((word, position) => ({
          trackId,
          lineId: id,
          position,
          text: word.text,
          start: word.start,
          end: word.end,
        })),
      ),
    );
    return true;
  }

  /**
   * The Track's Timed lyrics: its lines with their words, in the order they are
   * sung. Lines and words come back in one relational query, not one per line.
   */
  async findTimedLyrics(trackId: string): Promise<TimedLyricLine[]> {
    const rows = await this.txHost.tx.query.trackLyricLines.findMany({
      where: eq(trackLyricLines.trackId, trackId),
      orderBy: [asc(trackLyricLines.position)],
      columns: { start: true, end: true },
      with: {
        words: {
          columns: { text: true, start: true, end: true },
          orderBy: [asc(trackLyricWords.position)],
        },
      },
    });
    return rows.map(({ start, end, words }) => ({
      start,
      end,
      words: words.map((word) => ({
        text: word.text,
        start: word.start,
        end: word.end,
      })),
    }));
  }
}
