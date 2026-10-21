import { recordEventsBodySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class RecordEventsBodyDto extends createZodDto(recordEventsBodySchema) {}
