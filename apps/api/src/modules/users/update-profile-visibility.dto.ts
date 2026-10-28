import { updateProfileVisibilityBodySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class UpdateProfileVisibilityBodyDto extends createZodDto(
  updateProfileVisibilityBodySchema,
) {}
