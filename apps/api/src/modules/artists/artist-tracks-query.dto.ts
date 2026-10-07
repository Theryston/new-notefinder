import { cursorPaginationQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ArtistTracksQueryDto extends createZodDto(
  cursorPaginationQuerySchema,
) {}
