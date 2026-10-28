import {
  type CreateEditorialPinBody,
  type EditorialPin,
  type EditorialPinSource,
} from '@vozzify/contracts';
import type { EditorialPinWrite } from './editorial-pin-state.js';
import { toEditorialPin } from './editorial-pin-state.js';

/** A source as the database holds it: Tracks in order, or a dynamic reference. */
const sourceWriteOf = (
  source: EditorialPinSource,
): Pick<EditorialPinWrite, 'trackIds' | 'dynamicSource'> =>
  source.type === 'tracks'
    ? { trackIds: source.trackIds, dynamicSource: null }
    : { trackIds: [], dynamicSource: source };

/** The fields of a validated body, as the database stores them. */
export const editorialPinWriteOf = (
  body: CreateEditorialPinBody,
): EditorialPinWrite => ({
  kind: body.kind,
  layout: body.layout,
  position: body.position,
  priority: body.priority ?? 0,
  audience: body.audience ?? 'everyone',
  locale: body.locale ?? null,
  startsAt: body.startsAt ? new Date(body.startsAt) : null,
  endsAt: body.endsAt ? new Date(body.endsAt) : null,
  titles: body.titles,
  sponsored: body.sponsored ?? false,
  ...sourceWriteOf(body.source),
});

/** Builds the unsaved pin with the same row id as a saved pin being edited. */
export const previewPinOf = (
  body: CreateEditorialPinBody,
  pinId?: string,
  now = new Date(),
): EditorialPin =>
  toEditorialPin({
    ...editorialPinWriteOf(body),
    id: pinId ?? 'preview',
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  });
