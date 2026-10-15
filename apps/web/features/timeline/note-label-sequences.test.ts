import { describe, expect, it } from 'vitest';

import { noteOn } from '@/lib/note-fixtures';

import { layoutNoteLabels } from './note-label-layout';

const bounds = { left: 44, right: 770, now: 0 };
const sources = [
  {
    note: noteOn('D#', 4, 1, 1.32),
    box: { x: 340, y: 140, width: 31, height: 21 },
    label: true,
  },
  {
    note: noteOn('D#', 4, 1.32, 1.88),
    box: { x: 371, y: 140, width: 54, height: 21 },
    label: true,
  },
  {
    note: noteOn('B', 3, 1.88, 2.1),
    box: { x: 425, y: 232, width: 21, height: 21 },
    label: true,
  },
  {
    note: noteOn('C#', 4, 2.1, 2.51),
    box: { x: 446, y: 186, width: 39, height: 21 },
    label: true,
  },
  {
    note: noteOn('B', 3, 2.51, 2.72),
    box: { x: 485, y: 232, width: 20, height: 21 },
    label: true,
  },
  {
    note: noteOn('B', 3, 2.72, 3.04),
    box: { x: 505, y: 232, width: 31, height: 21 },
    label: true,
  },
];

describe('labels for consecutive note chips', () => {
  it('names both touching pairs in the Boat passage once each', () => {
    const labels = layoutNoteLabels(sources, bounds);
    expect(labels).toHaveLength(4);
    expect(labels.map((label) => label.note)).toEqual([
      sources[0]?.note,
      sources[2]?.note,
      sources[3]?.note,
      sources[4]?.note,
    ]);
    expect(labels[0]?.box.x).toBe(340);
    expect(labels.at(-1)?.box.x).toBe(485);
  });

  it('allows a name across a word boundary without merging the note bars', () => {
    const pair = [
      {
        note: noteOn('D#', 4, 1, 1.1),
        box: { x: 100, y: 20, width: 10, height: 16 },
        label: true,
      },
      {
        note: noteOn('D#', 4, 1.1, 1.4),
        box: { x: 110, y: 20, width: 29, height: 16 },
        label: true,
      },
    ];
    const labels = layoutNoteLabels(pair, bounds);
    expect(labels).toHaveLength(1);
    expect(labels[0]?.box.x).toBe(100);
    expect(labels[0]?.inside).toBe(true);
    expect(pair.map((source) => source.box.width)).toEqual([10, 29]);
  });

  it('does not let a note in another lane block a short chip label', () => {
    const pair = [
      {
        note: noteOn('C#', 4, 1, 1.1),
        box: { x: 100, y: 20, width: 10, height: 20 },
        label: true,
      },
      {
        note: noteOn('D#', 4, 1.1, 1.4),
        box: { x: 110, y: 44, width: 60, height: 20 },
        label: true,
      },
    ];
    const labels = layoutNoteLabels(pair, bounds);
    expect(labels).toHaveLength(2);
    expect(labels[0]?.box.x).toBeGreaterThan(110);
  });

  it('keeps separate labels for a real pause or a change of pitch', () => {
    const first = sources[0];
    const second = sources[1];
    if (!first || !second) throw new Error('missing passage');
    expect(
      layoutNoteLabels(
        [first, { ...second, note: noteOn('D#', 4, 2, 2.5) }],
        bounds,
      ),
    ).toHaveLength(2);
    expect(
      layoutNoteLabels(
        [
          first,
          {
            ...second,
            note: noteOn('E', 4, 1.32, 1.88),
            box: { ...second.box, y: 114 },
          },
        ],
        bounds,
      ),
    ).toHaveLength(2);
  });

  it('keeps a sequence named after its first word has passed', () => {
    const first = sources[0];
    const second = sources[1];
    if (!first || !second) throw new Error('missing passage');
    const labels = layoutNoteLabels([{ ...first, label: false }, second], {
      ...bounds,
      now: 1.5,
    });
    expect(labels).toHaveLength(1);
    expect(labels[0]?.note).toBe(second.note);
    expect(labels[0]?.box.x).toBe(second.box.x);
  });

  it('shares one name across three touching words, even in unsorted input', () => {
    const first = sources[0];
    const second = sources[1];
    if (!first || !second) throw new Error('missing passage');
    const third = {
      ...second,
      note: noteOn('D#', 4, 1.88, 2.4),
      box: { ...second.box, x: 425 },
    };
    const labels = layoutNoteLabels([third, second, first], bounds);
    expect(labels).toHaveLength(1);
    expect(labels[0]?.note).toBe(first.note);
    expect(labels[0]?.box.x).toBe(first.box.x);
  });
});
