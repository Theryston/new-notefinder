import { cursorPaginationQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class UserFavoritesQueryDto extends createZodDto(
  cursorPaginationQuerySchema,
) {}
