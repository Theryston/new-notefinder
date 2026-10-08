import { createTrackBodySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class CreateTrackBodyDto extends createZodDto(createTrackBodySchema) {}
