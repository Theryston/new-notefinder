import { removeFollowerParamSchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class RemoveFollowerParamDto extends createZodDto(
  removeFollowerParamSchema,
) {}
