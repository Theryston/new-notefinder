import { listOwnAttemptsQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ListOwnAttemptsQueryDto extends createZodDto(
  listOwnAttemptsQuerySchema,
) {}
