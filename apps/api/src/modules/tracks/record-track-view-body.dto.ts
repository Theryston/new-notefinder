import { recordTrackViewBodySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class RecordTrackViewBodyDto extends createZodDto(
  recordTrackViewBodySchema,
) {}
