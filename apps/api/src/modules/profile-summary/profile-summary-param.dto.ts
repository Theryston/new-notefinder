import { publicProfileParamSchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class PublicProfileSummaryParamDto extends createZodDto(
  publicProfileParamSchema,
) {}
