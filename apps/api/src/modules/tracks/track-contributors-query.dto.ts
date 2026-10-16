import { listTrackContributorsQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class TrackContributorsQueryDto extends createZodDto(
  listTrackContributorsQuerySchema,
) {}
