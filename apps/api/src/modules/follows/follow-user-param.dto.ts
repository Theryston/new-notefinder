import { followedUserParamSchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class FollowedUserParamDto extends createZodDto(
  followedUserParamSchema,
) {}
