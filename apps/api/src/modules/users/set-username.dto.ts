import { setUsernameBodySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class SetUsernameBodyDto extends createZodDto(setUsernameBodySchema) {}
