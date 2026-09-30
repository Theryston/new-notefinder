import {
  musicCatalogGetRecordingPayloadSchema,
  recordingSchema,
} from '@notefinder/contracts';
import { defineHandler, type Handler } from '../../ws/handler.js';
import type { RecordingService } from './recording.service.js';

export const createGetRecordingHandler = (service: RecordingService): Handler =>
  defineHandler({
    type: 'getRecording',
    payload: musicCatalogGetRecordingPayloadSchema,
    result: recordingSchema,
    run: ({ mbid }) => service.getRecording(mbid),
  });
