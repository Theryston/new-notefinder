import { listOwnAttemptsQuerySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ListOwnAttemptsQueryDto extends createZodDto(
  listOwnAttemptsQuerySchema,
) {}
