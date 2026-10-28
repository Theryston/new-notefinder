import { listTrackContributorsQuerySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class TrackContributorsQueryDto extends createZodDto(
  listTrackContributorsQuerySchema,
) {}
