import { retryTrackBodySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class RetryTrackBodyDto extends createZodDto(retryTrackBodySchema) {}
