import { updateMeBodySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class UpdateMeBodyDto extends createZodDto(updateMeBodySchema) {}
