import {
  type CreateEditorialPinBody,
  type EditorialPin,
  type EditorialPinHistoryPage,
  type EditorialPinKind,
  type EditorialPinPage,
  editorialPinHistoryPageSchema,
  editorialPinPageSchema,
  editorialPinSchema,
  type PinTrackSearchResult,
  pinTrackSearchResultSchema,
  type UpdateEditorialPinBody,
} from '@notefinder/contracts';
import { z } from 'zod';

import { browserApi } from '@/lib/api/browser';

const pinPath = (pinId: string): `/${string}` =>
  `/admin/home-pins/${encodeURIComponent(pinId)}`;

/**
 * The admin's pins (`GET /v1/admin/home-pins`), newest first. Loaded on
 * demand (`import()`): parsing runs through the contracts, which would pull
 * Zod into the page's first-load JavaScript otherwise.
 */
export async function fetchAdminPins(
  signal?: AbortSignal,
): Promise<EditorialPinPage> {
  return browserApi('/admin/home-pins', {
    schema: editorialPinPageSchema,
    query: { limit: 100 },
    signal,
  });
}

/** Who created and changed a pin and when (`GET …/:pinId/history`). */
export async function fetchAdminPinHistory(
  pinId: string,
  signal?: AbortSignal,
): Promise<EditorialPinHistoryPage> {
  return browserApi(`${pinPath(pinId)}/history`, {
    schema: editorialPinHistoryPageSchema,
    query: { limit: 100 },
    signal,
  });
}

/** Pins a hero or a row (`POST /v1/admin/home-pins`). */
export async function createAdminPin(
  body: CreateEditorialPinBody,
): Promise<EditorialPin> {
  return browserApi('/admin/home-pins', {
    method: 'POST',
    schema: editorialPinSchema,
    body,
  });
}

/** Changes a pin (`PATCH /v1/admin/home-pins/:pinId`). */
export async function updateAdminPin(
  pinId: string,
  body: UpdateEditorialPinBody,
): Promise<EditorialPin> {
  return browserApi(pinPath(pinId), {
    method: 'PATCH',
    schema: editorialPinSchema,
    body,
  });
}

/** Removes a pin (`DELETE /v1/admin/home-pins/:pinId`). */
export function deleteAdminPin(pinId: string): Promise<void> {
  return browserApi(pinPath(pinId), {
    method: 'DELETE',
    schema: z.undefined(),
  });
}

/**
 * The Tracks the pin picker may offer (`q`) or shows (`ids`). Loaded on
 * demand (`import()`): parsing runs through the contracts, which would pull
 * Zod into the page's first-load JavaScript otherwise.
 */
export function searchPinTracks(
  query: {
    q?: string;
    ids?: string;
    kind?: EditorialPinKind;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<PinTrackSearchResult> {
  const { q, ids, kind, limit } = query;
  return browserApi('/admin/tracks/search', {
    schema: pinTrackSearchResultSchema,
    query: {
      ...(q !== undefined ? { q } : {}),
      ...(ids !== undefined ? { ids } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(limit !== undefined ? { limit } : {}),
    },
    signal,
  });
}
