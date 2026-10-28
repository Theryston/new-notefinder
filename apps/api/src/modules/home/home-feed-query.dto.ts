import { homeFeedQuerySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class HomeFeedQueryDto extends createZodDto(homeFeedQuerySchema) {}
