import { listTrackSitemapQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ListTrackSitemapQueryDto extends createZodDto(
  listTrackSitemapQuerySchema,
) {}
