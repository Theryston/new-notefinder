import { cursorPaginationQuerySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class UserFavoritesQueryDto extends createZodDto(
  cursorPaginationQuerySchema,
) {}
