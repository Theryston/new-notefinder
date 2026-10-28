import { streakHeartbeatBodySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class StreakHeartbeatBodyDto extends createZodDto(
  streakHeartbeatBodySchema,
) {}
