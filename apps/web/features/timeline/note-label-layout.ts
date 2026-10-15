import type { TrackNote } from '@notefinder/contracts';

import { keyOf, noteName } from '@/lib/music-notes';

import { fitsLabel, noteStateAt, PIXELS_PER_SECOND } from './timeline-geometry';

type Box = { x: number; y: number; width: number; height: number };
type Source = { note: TrackNote; box: Box; label: boolean };
type Group = Source & { members: Source[] };
type Placement = { note: TrackNote; box: Box; inside: boolean };
type Bounds = { left: number; right: number; now: number };

const GAP = 3;
// The 10px mono font advances about 6px; leave room for padding and sharps.
const CHARACTER_WIDTH = 6.5;

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width + GAP &&
    a.x + a.width + GAP > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function visibleBox(box: Box, bounds: Bounds): Box {
  const x = Math.max(box.x, bounds.left);
  return {
    ...box,
    x,
    width: Math.max(0, Math.min(box.x + box.width, bounds.right) - x),
  };
}

function candidates(source: Group, bounds: Bounds): Box[] {
  const start = source.members.find((member) => member.label)?.box.x;
  const box = visibleBox(source.box, {
    ...bounds,
    left: Math.max(bounds.left, start ?? bounds.left),
  });
  const width = Math.max(
    30,
    noteName(keyOf(source.note)).length * CHARACTER_WIDTH + 10,
  );
  if (!fitsLabel(width, box.height) || box.width === 0) return [];
  const outside = [
    { ...box, x: box.x + box.width + GAP, width },
    { ...box, x: box.x - width - GAP, width },
  ];
  return box.width >= width ? [{ ...box, width }, ...outside] : outside;
}

function touches(a: Source, b: Source): boolean {
  const gap = b.box.x - a.box.x - a.box.width;
  return (
    keyOf(a.note) === keyOf(b.note) &&
    Math.abs(b.note.start - a.note.end) <= GAP / PIXELS_PER_SECOND &&
    gap >= -GAP &&
    gap <= GAP
  );
}

function groupSources(sources: readonly Source[]): Group[] {
  const groups: Group[] = [];
  for (const source of [...sources].sort(
    (a, b) => a.note.start - b.note.start,
  )) {
    const previous = groups.at(-1);
    const last = previous?.members.at(-1);
    if (previous && last && touches(last, source)) {
      previous.box.width = Math.max(
        previous.box.width,
        source.box.x + source.box.width - previous.box.x,
      );
      previous.members.push(source);
      if (!previous.label && source.label) previous.note = source.note;
      previous.label ||= source.label;
    } else {
      groups.push({ ...source, box: { ...source.box }, members: [source] });
    }
  }
  return groups;
}

function textBox(box: Box, note: TrackNote): Box {
  return {
    x: box.x + 5,
    y: box.y + (box.height - 10) / 2,
    width: noteName(keyOf(note)).length * CHARACTER_WIDTH,
    height: 10,
  };
}

function available(
  box: Box,
  source: Source,
  sources: readonly Source[],
  placements: readonly Placement[],
): boolean {
  return (
    !sources.some(
      (other) =>
        other !== source && overlaps(textBox(box, source.note), other.box),
    ) &&
    !placements.some((other) =>
      overlaps(textBox(box, source.note), textBox(other.box, other.note)),
    )
  );
}

/**
 * Keep durations true to time. Touching repetitions share one name; short
 * sequences borrow clear space beside them. Only the text footprint reserves
 * space, and the current sequence gets first choice in dense passages.
 */
export function layoutNoteLabels(
  sources: readonly Source[],
  bounds: Bounds,
): Placement[] {
  const placements: Placement[] = [];
  const groups = groupSources(sources);
  const current = (group: Group) =>
    group.members.some(
      (member) => noteStateAt(member.note, bounds.now) === 'current',
    );
  const ordered = [...groups].sort(
    (a, b) => Number(current(b)) - Number(current(a)),
  );
  for (const source of ordered) {
    if (!source.label) continue;
    const box = candidates(source, bounds).find(
      (candidate) =>
        candidate.x >= bounds.left &&
        candidate.x + candidate.width <= bounds.right &&
        available(candidate, source, groups, placements),
    );
    if (box) {
      placements.push({
        note: source.note,
        box,
        inside:
          box.x >= source.box.x &&
          box.x + box.width <= source.box.x + source.box.width,
      });
    }
  }
  return placements;
}
