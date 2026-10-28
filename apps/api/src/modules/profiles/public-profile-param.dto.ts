import { publicProfileParamSchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class PublicProfileParamDto extends createZodDto(
  publicProfileParamSchema,
) {}
