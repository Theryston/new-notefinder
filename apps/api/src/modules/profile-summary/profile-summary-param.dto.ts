import { publicProfileParamSchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class PublicProfileSummaryParamDto extends createZodDto(
  publicProfileParamSchema,
) {}
