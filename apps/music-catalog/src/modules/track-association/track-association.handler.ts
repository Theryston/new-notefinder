import {
  musicCatalogTrackAssociationPayloadSchema,
  musicCatalogTrackAssociationResultSchema,
} from '@notefinder/contracts';
import { defineHandler, type Handler } from '../../ws/handler.js';
import type { TrackAssociationService } from './track-association.service.js';

export const createTrackAssociationHandler = (
  service: TrackAssociationService,
): Handler =>
  defineHandler({
    type: 'associateTrack',
    payload: musicCatalogTrackAssociationPayloadSchema,
    result: musicCatalogTrackAssociationResultSchema,
    run: (payload) => service.associate(payload),
  });
