import { Injectable } from '@nestjs/common';
import type { HomeCarouselRow, HomeHero, HomeRow } from '@notefinder/contracts';
import { composeHomeRows } from './home-feed-composer.js';
import { type PersonalTaste } from './home-personal.js';
import { PersonalHomeRepository } from './home-personal.repository.js';
import {
  blendDiscoveryCandidates,
  byBlendedDesc,
  type DiscoveryCandidate,
} from './home-personal-blend.js';

@Injectable()
export class PersonalHomePublicRowsService {
  constructor(private readonly personal: PersonalHomeRepository) {}

  async blendPool(
    publicRows: HomeRow[],
    taste: PersonalTaste,
    lambda: number,
    mastered: ReadonlySet<string>,
  ): Promise<DiscoveryCandidate[]> {
    const pool = publicRows.flatMap((row) =>
      row.layout === 'hero'
        ? [row.track]
        : row.layout === 'standard'
          ? row.items
          : [],
    );
    const ids = [...new Set(pool.map((track) => track.id))];
    const discovery = await this.personal.findDiscoveryTracks(ids);
    return blendDiscoveryCandidates({ tracks: pool, discovery, taste, lambda })
      .filter((candidate) => !mastered.has(candidate.track.id))
      .sort(byBlendedDesc);
  }

  rows(
    publicRows: HomeRow[],
    sorted: DiscoveryCandidate[],
    mastered: ReadonlySet<string>,
    usedTrackIds: ReadonlySet<string>,
  ): HomeRow[] {
    const available = sorted.filter(
      (candidate) => !usedTrackIds.has(candidate.track.id),
    );
    const hero = this.heroRow(available);
    return [
      ...(hero ? [hero] : []),
      ...this.standardRows(publicRows, sorted, mastered, usedTrackIds),
    ];
  }

  private heroRow(sorted: DiscoveryCandidate[]): HomeRow | undefined {
    const track = sorted.find((candidate) => candidate.hasCover)?.track;
    return track
      ? ({ id: 'hero', layout: 'hero', track } satisfies HomeHero)
      : undefined;
  }

  private standardRows(
    publicRows: HomeRow[],
    sorted: DiscoveryCandidate[],
    mastered: ReadonlySet<string>,
    usedTrackIds: ReadonlySet<string>,
  ): HomeRow[] {
    const heroId = sorted.find((candidate) => candidate.hasCover)?.track.id;
    const blended = new Map(
      sorted.map((candidate) => [candidate.track.id, candidate]),
    );
    return publicRows.flatMap((row) => {
      if (row.layout !== 'standard') return [];
      const candidates = row.items
        .map((track) => blended.get(track.id))
        .filter(
          (candidate): candidate is DiscoveryCandidate =>
            candidate !== undefined &&
            candidate.track.id !== heroId &&
            !mastered.has(candidate.track.id) &&
            !usedTrackIds.has(candidate.track.id),
        )
        .sort(byBlendedDesc);
      return this.composeStandardRow(row, candidates);
    });
  }

  private composeStandardRow(
    row: Extract<HomeRow, { layout: 'standard' }>,
    candidates: DiscoveryCandidate[],
  ): HomeRow[] {
    const [composed] = composeHomeRows([
      {
        id: row.id,
        layout: 'standard' as const,
        title: row.title,
        items: candidates.map((candidate) => ({
          id: candidate.track.id,
          artistKey: candidate.artistKey,
          hasCover: candidate.hasCover,
          isCompleted: true,
        })),
      },
    ]);
    if (!composed?.title) return [];
    const itemsById = new Map(row.items.map((track) => [track.id, track]));
    return [
      {
        id: composed.id,
        layout: 'standard',
        title: composed.title,
        items: composed.items.map((item) => {
          const track = itemsById.get(item.id);
          if (!track) throw new Error(`Discovery row lost Track ${item.id}`);
          return track;
        }),
      } satisfies HomeCarouselRow,
    ];
  }
}
