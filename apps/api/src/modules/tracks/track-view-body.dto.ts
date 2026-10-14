import { trackViewBodySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class TrackViewBodyDto extends createZodDto(trackViewBodySchema) {}
