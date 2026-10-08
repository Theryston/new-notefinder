import {
  musicCatalogGetReleaseGroupPayloadSchema,
  musicCatalogReleaseGroupSchema,
} from '@notefinder/contracts';
import { defineHandler, type Handler } from '../../ws/handler.js';
import type { ReleaseGroupService } from './release-group.service.js';

export const createGetReleaseGroupHandler = (
  service: ReleaseGroupService,
): Handler =>
  defineHandler({
    type: 'getReleaseGroup',
    payload: musicCatalogGetReleaseGroupPayloadSchema,
    result: musicCatalogReleaseGroupSchema,
    run: ({ mbid }) => service.getReleaseGroup(mbid),
  });
