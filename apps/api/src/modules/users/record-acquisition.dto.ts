import { recordAcquisitionBodySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class RecordAcquisitionBodyDto extends createZodDto(
  recordAcquisitionBodySchema,
) {}
