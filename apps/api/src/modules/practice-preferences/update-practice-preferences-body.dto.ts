import { updatePracticePreferencesBodySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class UpdatePracticePreferencesBodyDto extends createZodDto(
  updatePracticePreferencesBodySchema,
) {}
