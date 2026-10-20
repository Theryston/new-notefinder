import { Injectable } from '@nestjs/common';
import type {
  EditorialPin,
  HomeRow,
  HomeRowTitle,
  HomeTrack,
  Locale,
} from '@notefinder/contracts';
import { EditorialPinsService } from '../editorial-pins/editorial-pins.service.js';
import { HomeRepository } from './home.repository.js';
import { toHomeTrack } from './home-feed-builder.service.js';
import { applyEditorialPins, type OverlayPin } from './home-pin-overlay.js';
import { toHomeCandidate } from './home-row-sources.js';

/**
 * The title key of a pinned row. Its text is the admin's, in the locale of the
 * feed, sent as the `title` parameter: the web renders it as `{title}`.
 */
export const PINNED_ROW_TITLE_KEY = 'home.rows.pinned';

type Viewer = { locale: Locale; signedIn: boolean };

/**
 * Reads the pins live for a viewer and applies them over the feed rows. The
 * Tracks of the pins are read here (completed ones only), so a Track that
 * became ineligible is skipped without any regeneration.
 */
@Injectable()
export class HomePinOverlayService {
  constructor(
    private readonly pins: EditorialPinsService,
    private readonly homeRepository: HomeRepository,
  ) {}

  async apply(rows: HomeRow[], viewer: Viewer): Promise<HomeRow[]> {
    const live = await this.pins.findLivePins(viewer);
    if (live.length === 0) {
      return rows;
    }
    const trackIds = [...new Set(live.flatMap((pin) => pin.source.trackIds))];
    const records =
      await this.homeRepository.findCompletedTracksByIds(trackIds);
    const tracksById = new Map(
      records.map((record) => [
        record.id,
        toHomeTrack(toHomeCandidate(record)),
      ]),
    );
    const pins = live.flatMap((pin) => {
      const overlayPin = toOverlayPin(pin, viewer.locale, tracksById);
      return overlayPin ? [overlayPin] : [];
    });
    return applyEditorialPins(rows, pins);
  }
}

/** A live pin as the overlay places it, or nothing when it has no title here. */
const toOverlayPin = (
  pin: EditorialPin,
  locale: Locale,
  tracksById: ReadonlyMap<string, HomeTrack>,
): OverlayPin | undefined => {
  const title = pin.titles[locale];
  if (title === undefined) {
    return undefined;
  }
  const pinnedTitle: HomeRowTitle = {
    key: PINNED_ROW_TITLE_KEY,
    params: { title },
  };
  return {
    id: pin.id,
    kind: pin.kind,
    position: pin.position,
    priority: pin.priority,
    createdAt: Date.parse(pin.createdAt),
    sponsored: pin.sponsored,
    title: pinnedTitle,
    tracks: pin.source.trackIds.flatMap((trackId) => {
      const track = tracksById.get(trackId);
      return track ? [track] : [];
    }),
  };
};
