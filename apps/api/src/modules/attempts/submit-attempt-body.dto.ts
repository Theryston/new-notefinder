import { submitPracticeAttemptBodySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class SubmitAttemptBodyDto extends createZodDto(
  submitPracticeAttemptBodySchema,
) {}
