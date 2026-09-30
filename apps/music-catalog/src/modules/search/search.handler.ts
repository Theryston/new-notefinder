import {
  musicCatalogSearchPayloadSchema,
  musicCatalogSearchResultSchema,
} from '@notefinder/contracts';
import { defineHandler, type Handler } from '../../ws/handler.js';
import type { SearchService } from './search.service.js';

export const createSearchHandler = (service: SearchService): Handler =>
  defineHandler({
    type: 'search',
    payload: musicCatalogSearchPayloadSchema,
    result: musicCatalogSearchResultSchema,
    run: (params) => service.search(params),
  });
