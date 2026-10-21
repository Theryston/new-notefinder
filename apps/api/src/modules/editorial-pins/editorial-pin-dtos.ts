import {
  createEditorialPinBodySchema,
  cursorPaginationQuerySchema,
  editorialPinIdParamSchema,
  pinTrackSearchQuerySchema,
  updateEditorialPinBodySchema,
} from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class CreateEditorialPinBodyDto extends createZodDto(
  createEditorialPinBodySchema,
) {}

export class UpdateEditorialPinBodyDto extends createZodDto(
  updateEditorialPinBodySchema,
) {}

export class EditorialPinIdParamDto extends createZodDto(
  editorialPinIdParamSchema,
) {}

export class EditorialPinPageQueryDto extends createZodDto(
  cursorPaginationQuerySchema,
) {}

export class PinTrackSearchQueryDto extends createZodDto(
  pinTrackSearchQuerySchema,
) {}
