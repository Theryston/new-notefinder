import {
  musicCatalogArtistSchema,
  musicCatalogGetArtistPayloadSchema,
} from '@notefinder/contracts';
import { defineHandler, type Handler } from '../../ws/handler.js';
import type { ArtistService } from './artist.service.js';

export const createGetArtistHandler = (service: ArtistService): Handler =>
  defineHandler({
    type: 'getArtist',
    payload: musicCatalogGetArtistPayloadSchema,
    result: musicCatalogArtistSchema,
    run: ({ mbid }) => service.getArtist(mbid),
  });
