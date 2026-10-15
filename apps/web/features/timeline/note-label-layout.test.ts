import { describe, expect, it } from 'vitest';

import { noteOn } from '@/lib/note-fixtures';

import { layoutNoteLabels } from './note-label-layout';

const note = noteOn('C#', 4, 1, 1.1);
const bounds = { left: 44, right: 360, now: 0 };
const short = {
  note,
  box: { x: 100, y: 20, width: 8, height: 12 },
  label: true,
};

describe('timeline note labels', () => {
  it('names a short note beside its bar without extending its duration', () => {
    expect(layoutNoteLabels([short], bounds)).toEqual([
      { note, box: { x: 111, y: 20, width: 30, height: 12 }, inside: false },
    ]);
    expect(short.box.width).toBe(8);
  });

  it('keeps a label inside a bar with room for it', () => {
    const source = { ...short, box: { ...short.box, width: 80 } };
    expect(layoutNoteLabels([source], bounds)).toEqual([
      { note, box: { ...source.box, width: 30 }, inside: true },
    ]);
  });

  it('uses the space on the left when another note blocks the right', () => {
    const neighbor = {
      ...short,
      note: noteOn('C#', 4, 2, 3),
      box: { ...short.box, x: 113, width: 80 },
    };
    expect(layoutNoteLabels([short, neighbor], bounds)[0]?.box.x).toBe(67);
  });

  it('never draws the name under the keyboard or outside the canvas', () => {
    const source = { ...short, box: { ...short.box, x: 46 } };
    expect(layoutNoteLabels([source], { ...bounds, right: 60 })).toEqual([]);
  });

  it('places the label in the visible part of a partially clipped long bar', () => {
    const source = { ...short, box: { ...short.box, x: 5, width: 100 } };
    expect(layoutNoteLabels([source], bounds)[0]?.box).toEqual({
      x: 44,
      y: 20,
      width: 30,
      height: 12,
    });
  });

  it('allows neighboring lanes to use the same horizontal space', () => {
    const nextLane = {
      ...short,
      note: noteOn('D', 4, 2, 2.1),
      box: { ...short.box, y: 34 },
    };
    expect(layoutNoteLabels([short, nextLane], bounds)).toHaveLength(2);
  });

  it('prioritizes the current note when two labels need the same gap', () => {
    const current = {
      ...short,
      note: noteOn('C#', 4, 2, 2.1),
      box: { ...short.box, x: 150 },
    };
    const previous = { ...short, box: { ...short.box, x: 100 } };
    const result = layoutNoteLabels([previous, current], {
      left: 100,
      right: 158,
      now: 2.05,
    });
    expect(result).toEqual([
      {
        note: current.note,
        box: { x: 117, y: 20, width: 30, height: 12 },
        inside: false,
      },
    ]);
  });

  it('does not label hidden notes or lanes too thin for readable text', () => {
    expect(layoutNoteLabels([{ ...short, label: false }], bounds)).toEqual([]);
    expect(
      layoutNoteLabels(
        [{ ...short, box: { ...short.box, height: 8 } }],
        bounds,
      ),
    ).toEqual([]);
  });

  it('leaves crowded bars unlabeled rather than overlap another chip', () => {
    const result = layoutNoteLabels(
      [short, { ...short, box: { ...short.box, x: 110, width: 80 } }],
      { left: 98, right: 190, now: 0 },
    );
    expect(result.some((placement) => placement.box.x < 110)).toBe(false);
  });
});
