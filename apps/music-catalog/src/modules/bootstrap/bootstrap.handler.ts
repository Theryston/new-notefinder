import {
  musicCatalogStatusPayloadSchema,
  musicCatalogStatusResultSchema,
} from '@notefinder/contracts';
import { defineHandler, type Handler } from '../../ws/handler.js';
import type { BootstrapService } from './bootstrap.service.js';

export const createStatusHandler = (service: BootstrapService): Handler =>
  defineHandler({
    type: 'status',
    payload: musicCatalogStatusPayloadSchema,
    result: musicCatalogStatusResultSchema,
    run: () => service.getStatus(),
  });
