import { trackIdParamSchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class AttemptTrackParamDto extends createZodDto(trackIdParamSchema) {}
