import { listUserAttemptsQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ListUserAttemptsQueryDto extends createZodDto(
  listUserAttemptsQuerySchema,
) {}
