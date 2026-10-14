'use client';

import type { TrackLyricLine, TrackLyrics } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

import { playbackStore } from '../stores/playback-store';

type Position = { line: number; word: number };

function positionAt(lines: readonly TrackLyricLine[], time: number): Position {
  const lineIndex = lines.findIndex(
    (line) => line.start <= time && time < line.end,
  );
  const line = lines[lineIndex];
  if (lineIndex < 0 || !line) return { line: -1, word: -1 };
  const word = line.words.findIndex(
    (item) => item.start <= time && time < item.end,
  );
  return { line: lineIndex, word };
}

function samePosition(left: Position, right: Position) {
  return left.line === right.line && left.word === right.word;
}

function useCurrentPosition(lines: readonly TrackLyricLine[]) {
  const [position, setPosition] = useState(() =>
    positionAt(lines, playbackStore.getState().time),
  );
  useEffect(() => {
    const update = () => {
      const next = positionAt(lines, playbackStore.getState().time);
      setPosition((current) => (samePosition(current, next) ? current : next));
    };
    update();
    return playbackStore.subscribe(update);
  }, [lines]);
  return position;
}

function LyricText({
  line,
  activeWord,
}: {
  line: TrackLyricLine;
  activeWord: number;
}) {
  return line.words.map((word, index) => (
    <span key={`${word.text}-${word.start}-${word.end}`}>
      {index > 0 ? ' ' : null}
      <span
        data-current-word={index === activeWord ? 'true' : undefined}
        className={
          index === activeWord
            ? 'rounded-sm bg-primary/10 text-primary'
            : undefined
        }
      >
        {word.text}
      </span>
    </span>
  ));
}

/** Playback-synced current line and compact, seekable Timed lyrics. */
export function TimedLyrics({
  lyrics,
  onSeek,
}: {
  lyrics: TrackLyrics | undefined;
  onSeek: (seconds: number) => void;
}) {
  const t = useTranslations('tracks.practice.lyrics');
  const lines = lyrics?.lines ?? [];
  const position = useCurrentPosition(lines);
  if (lines.length === 0) return null;

  const activeLine = lines[position.line];
  return (
    <>
      <p aria-live="off" className="min-h-6 text-muted-foreground text-sm">
        {activeLine ? (
          <LyricText line={activeLine} activeWord={position.word} />
        ) : null}
      </p>
      <section
        aria-labelledby="track-lyrics-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="track-lyrics-heading" className="font-semibold text-lg">
          {t('heading')}
        </h2>
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
          {lines.map((line, index) => {
            const active = index === position.line;
            return (
              <Button
                key={`${line.start}-${line.end}`}
                type="button"
                variant="ghost"
                aria-current={active ? 'true' : undefined}
                className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left"
                onClick={() => onSeek(line.start)}
              >
                <span
                  className={active ? 'font-semibold text-primary' : undefined}
                >
                  <LyricText
                    line={line}
                    activeWord={active ? position.word : -1}
                  />
                </span>
              </Button>
            );
          })}
        </div>
      </section>
    </>
  );
}
