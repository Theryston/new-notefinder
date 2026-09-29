import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AVATAR_MAX_BYTES } from '@notefinder/contracts';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { invalidAvatar } from './avatar-image.js';

/** The file part of `PATCH /v1/me`, and the body field it fills. */
const AVATAR_FIELD = 'avatar';

// Enforced by multer while the request is read, so an oversized upload is
// refused as soon as it crosses the limit instead of being buffered whole.
// The rest of the form is a few short text fields.
const UPDATE_ME_LIMITS = {
  fields: 8,
  fieldSize: 16 * 1024,
  files: 1,
  fileSize: AVATAR_MAX_BYTES,
};

/** What multer leaves in `request.file` (memory storage). */
type UploadedFile = {
  buffer: Buffer<ArrayBuffer>;
  originalname: string;
  mimetype: string;
};

/**
 * Reads the multipart form of `PATCH /v1/me` and puts the Avatar file in the
 * body as a standard `File`, so the one `updateMeBodySchema` validates the
 * Name and the file together. A file over the size limit is a
 * `VALIDATION_FAILED` like any other bad field.
 */
@Injectable()
export class AvatarUploadInterceptor extends FileInterceptor(AVATAR_FIELD, {
  limits: UPDATE_ME_LIMITS,
}) {
  override async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    let handler: Observable<unknown>;
    try {
      handler = await super.intercept(context, next);
    } catch (error) {
      throw error instanceof PayloadTooLargeException
        ? invalidAvatar(`Avatar is larger than ${AVATAR_MAX_BYTES} bytes`)
        : error;
    }
    const request: Request & { file?: UploadedFile } = context
      .switchToHttp()
      .getRequest();
    if (request.file) {
      const { buffer, originalname, mimetype } = request.file;
      request.body[AVATAR_FIELD] = new File([buffer], originalname, {
        type: mimetype,
      });
    }
    return handler;
  }
}
