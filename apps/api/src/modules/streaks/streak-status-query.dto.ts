import { streakStatusQuerySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class StreakStatusQueryDto extends createZodDto(
  streakStatusQuerySchema,
) {}
