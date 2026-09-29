import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
} from '@notefinder/contracts/avatar-rules';

export type AvatarFileProblem = 'unsupportedType' | 'tooLarge';

/** Value for the file input's `accept`: the picker offers only these types. */
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(',');

/** Largest Avatar in megabytes, for the messages that name the limit. */
export const AVATAR_MAX_MEGABYTES = AVATAR_MAX_BYTES / (1024 * 1024);

const isAcceptedType = (type: string): boolean =>
  AVATAR_MIME_TYPES.some((accepted) => accepted === type);

/**
 * What is wrong with a picked file, so the user hears about it before
 * waiting on an upload the API would refuse. Only a first look, from the type
 * the browser reports and the size: the API decides from the file's content.
 */
export function avatarFileProblem(
  file: Pick<File, 'type' | 'size'>,
): AvatarFileProblem | null {
  if (!isAcceptedType(file.type)) return 'unsupportedType';
  if (file.size > AVATAR_MAX_BYTES) return 'tooLarge';
  return null;
}
