import type { EditorialPinState } from '@vozzify/contracts';
import {
  affectedLocales,
  changedFieldsOf,
  type EditorialPinWrite,
  stateOf,
  toEditorialPin,
} from './editorial-pin-state.js';

const write = (
  overrides: Partial<EditorialPinWrite> = {},
): EditorialPinWrite => ({
  kind: 'row',
  layout: 'standard',
  position: 2,
  priority: 1,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Festive', 'pt-BR': 'Festivo' },
  sponsored: false,
  trackIds: ['t1', 't2'],
  ...overrides,
});

const stateOfWrite = (overrides: Partial<EditorialPinWrite> = {}) =>
  stateOf(write(overrides));

describe('editorial pin state', () => {
  describe('stateOf', () => {
    it('names the pin as the API does: the source as a Track list, the dates as ISO strings', () => {
      const state = stateOf(
        write({
          locale: 'en',
          startsAt: new Date('2026-10-21T00:00:00.000Z'),
          endsAt: new Date('2026-10-22T00:00:00.000Z'),
          sponsored: true,
        }),
      );

      expect(state).toEqual({
        kind: 'row',
        layout: 'standard',
        source: { type: 'tracks', trackIds: ['t1', 't2'] },
        position: 2,
        priority: 1,
        audience: 'everyone',
        locale: 'en',
        startsAt: '2026-10-21T00:00:00.000Z',
        endsAt: '2026-10-22T00:00:00.000Z',
        titles: { en: 'Festive', 'pt-BR': 'Festivo' },
        sponsored: true,
      });
    });

    it('keeps a null window as null', () => {
      expect(stateOfWrite()).toMatchObject({ startsAt: null, endsAt: null });
    });

    it('copies the Tracks and the titles, so later edits do not reach the state', () => {
      const pin = write();

      const state = stateOf(pin);
      pin.trackIds.push('t3');
      pin.titles.en = 'Changed';

      expect(state.source).toEqual({ type: 'tracks', trackIds: ['t1', 't2'] });
      expect(state.titles.en).toBe('Festive');
    });
  });

  describe('changedFieldsOf', () => {
    it('names nothing for two equal states', () => {
      expect(changedFieldsOf(stateOfWrite(), stateOfWrite())).toEqual([]);
    });

    it('names each field that differs, in the order of the history fields', () => {
      const before = stateOfWrite();
      const after = stateOfWrite({
        sponsored: true,
        position: 5,
        trackIds: ['t2', 't1'],
      });

      expect(changedFieldsOf(before, after)).toEqual([
        'source',
        'position',
        'sponsored',
      ]);
    });

    it('detects a change of every field a pin can have', () => {
      const base = stateOfWrite();
      const changes: Partial<EditorialPinWrite>[] = [
        { priority: 9 },
        { audience: 'visitors' },
        { locale: 'pt-BR' },
        { startsAt: new Date('2026-10-21T00:00:00.000Z') },
        { endsAt: new Date('2026-10-21T00:00:00.000Z') },
        { titles: { en: 'Other', 'pt-BR': 'Festivo' } },
      ];

      for (const change of changes) {
        expect(changedFieldsOf(base, stateOfWrite(change))).toHaveLength(1);
      }
    });

    it('reports the kind and the layout of a pin that becomes a hero', () => {
      expect(
        changedFieldsOf(
          stateOfWrite(),
          stateOfWrite({ kind: 'hero', layout: 'hero' }),
        ),
      ).toEqual(['kind', 'layout']);
    });

    it('does not count the order of the title keys as a change', () => {
      const reordered = stateOfWrite({
        titles: { 'pt-BR': 'Festivo', en: 'Festive' },
      });

      expect(changedFieldsOf(stateOfWrite(), reordered)).toEqual([]);
    });

    it('counts a title added in one locale as a change', () => {
      const withoutPortuguese = stateOfWrite({ titles: { en: 'Festive' } });

      expect(changedFieldsOf(stateOfWrite(), withoutPortuguese)).toEqual([
        'titles',
      ]);
    });

    it('compares the source as the Tracks in order, not as an object reference', () => {
      expect(
        changedFieldsOf(
          stateOfWrite({ trackIds: ['t1'] }),
          stateOfWrite({ trackIds: ['t1'] }),
        ),
      ).toEqual([]);
    });
  });

  describe('affectedLocales', () => {
    it('names the one locale of a locale-limited pin', () => {
      expect(affectedLocales('pt-BR')).toEqual(['pt-BR']);
    });

    it('names every locale for a pin that serves them all', () => {
      expect(affectedLocales(null)).toEqual(['en', 'pt-BR']);
    });
  });

  describe('toEditorialPin', () => {
    it('adds the ID, the audit fields and the ISO dates to the state', () => {
      const pin = toEditorialPin({
        ...write(),
        id: 'pin-1',
        createdBy: { id: 'admin-1', name: 'Ada' },
        updatedBy: null,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        updatedAt: new Date('2026-10-02T10:00:00.000Z'),
      });

      const state: EditorialPinState = pin;
      expect(state).toMatchObject({ kind: 'row', position: 2 });
      expect(pin).toMatchObject({
        id: 'pin-1',
        createdBy: { id: 'admin-1', name: 'Ada' },
        updatedBy: null,
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-02T10:00:00.000Z',
      });
    });
  });
});
