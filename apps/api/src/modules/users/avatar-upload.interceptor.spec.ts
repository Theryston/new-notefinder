import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AVATAR_MAX_BYTES } from '@notefinder/contracts';
import { firstValueFrom, type Observable, of } from 'rxjs';
import { ZodValidationException } from '../../common/zod/zod-validation.pipe.js';
import { AvatarUploadInterceptor } from './avatar-upload.interceptor.js';

type FormRequest = {
  body: Record<string, unknown>;
  file?: { buffer: Buffer; originalname: string; mimetype: string };
};

// What `FileInterceptor` contributes: it reads the multipart request (needs a
// real stream, so the e2e suite covers it) and leaves the file in
// `request.file`.
type FormReader = {
  intercept: (
    context: ExecutionContext,
    next: CallHandler,
  ) => Promise<Observable<unknown>>;
};
const formReader = Object.getPrototypeOf(
  AvatarUploadInterceptor.prototype,
) as FormReader;

const contextOf = (request: FormRequest) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const handler: CallHandler = { handle: () => of('handled') };

describe('AvatarUploadInterceptor', () => {
  const interceptor = new AvatarUploadInterceptor();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands the uploaded file to the body as a File', async () => {
    const request: FormRequest = { body: { name: 'Ada' } };
    vi.spyOn(formReader, 'intercept').mockImplementation(async (_, next) => {
      request.file = {
        buffer: Buffer.from([1, 2, 3]),
        originalname: 'me.png',
        mimetype: 'image/png',
      };
      return next.handle();
    });

    const result = await interceptor.intercept(contextOf(request), handler);

    const { avatar } = request.body;
    expect(avatar).toBeInstanceOf(File);
    if (!(avatar instanceof File)) {
      throw new Error('avatar is not a File');
    }
    expect(avatar.name).toBe('me.png');
    expect(avatar.type).toBe('image/png');
    expect(new Uint8Array(await avatar.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(request.body.name).toBe('Ada');
    await expect(firstValueFrom(result)).resolves.toBe('handled');
  });

  it('leaves the body alone when the form has no file', async () => {
    const request: FormRequest = { body: { name: 'Ada' } };
    vi.spyOn(formReader, 'intercept').mockImplementation(async (_, next) =>
      next.handle(),
    );

    await interceptor.intercept(contextOf(request), handler);

    expect(request.body).toEqual({ name: 'Ada' });
  });

  it('turns a file over the size limit into a validation error', async () => {
    const request: FormRequest = { body: {} };
    vi.spyOn(formReader, 'intercept').mockRejectedValue(
      new PayloadTooLargeException('File too large'),
    );

    const failure = await interceptor
      .intercept(contextOf(request), handler)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ZodValidationException);
    const { location, zodError } = failure as ZodValidationException;
    expect(location).toBe('body');
    expect(zodError.issues).toEqual([
      expect.objectContaining({
        path: ['avatar'],
        message: `Avatar is larger than ${AVATAR_MAX_BYTES} bytes`,
      }),
    ]);
    expect(request.body).toEqual({});
  });

  it('lets any other multipart error through as it is', async () => {
    const unexpectedField = new BadRequestException('Unexpected field');
    vi.spyOn(formReader, 'intercept').mockRejectedValue(unexpectedField);

    await expect(
      interceptor.intercept(contextOf({ body: {} }), handler),
    ).rejects.toBe(unexpectedField);
  });
});
