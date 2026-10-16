import type { TrackNote } from '@notefinder/contracts';

type Playback = { getState(): { status: string; time: number; rate: number } };
type Synth = { play(midi: number, seconds: number): void; stop(): void };

/** Runs against the current player, including direct audio and YouTube. */
export function startGuidePlayer({
  notes,
  playback,
  synth,
}: {
  notes: readonly TrackNote[];
  playback: Playback;
  synth: Synth;
}): () => void {
  let previous = '';
  let lastTime = -1;
  const tick = () => {
    const { status, time, rate } = playback.getState();
    const note = activeNote(notes, status, time);
    const key = note ? `${note.start}:${note.pitch}:${rate}` : '';
    const sought = time < lastTime || time - lastTime > 0.1 * rate;
    if (key !== previous || sought) {
      synth.stop();
      if (note) synth.play(note.pitch, (note.end - time) / rate);
      previous = key;
    }
    lastTime = time;
  };
  const timer = setInterval(tick, 16);
  tick();
  return () => {
    clearInterval(timer);
    synth.stop();
  };
}

function activeNote(notes: readonly TrackNote[], status: string, time: number) {
  if (status !== 'playing') return undefined;
  return notes.find((item) => item.start <= time && item.end > time);
}
