import {
  AVATAR_MAX_BYTES,
  cacheTags,
  currentUserSchema,
  NAME_MAX_LENGTH,
} from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { users } from '../src/database/schema/users.js';
import { StorageService } from '../src/integrations/storage/storage.service.js';
import {
  WEB_REVALIDATION_JOB,
  WEB_REVALIDATION_QUEUE,
} from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { createAuthClient, signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import { createTestApp } from './utils/create-test-app.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';
import {
  createImage,
  describeImage,
  type ImageFormat,
  isColor,
} from './utils/images.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

describe('PATCH /v1/me (e2e)', () => {
  const spec = useAuthSpec();
  let user: User;

  const revalidations = () =>
    spec.testApp.queues[WEB_REVALIDATION_QUEUE]?.added ?? [];

  const nameInDatabase = async () => {
    const [row] = await spec.testApp.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id));
    return row?.name;
  };

  const signInAs = async (overrides: Partial<User> = {}) => {
    user = await createUser(spec.testApp.db, {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      username: 'grace',
      image: 'https://example.com/grace.png',
      ...overrides,
    });
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  beforeEach(async () => {
    revalidations().length = 0;
    await signInAs();
  });

  describe('who can call it', () => {
    it('returns the UNAUTHORIZED envelope without a session', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: expect.any(String),
      });
      expect(await nameInDatabase()).toBe('Grace Hopper');
    });

    it('returns USERNAME_REQUIRED until a username is chosen', async () => {
      const newcomer = await createUser(spec.testApp.db, {
        name: 'Newcomer',
        email: 'newcomer@example.com',
        username: null,
      });
      await createCredentialAccount(spec.testApp.db, newcomer);
      const client = createAuthClient(spec.testApp);
      await signIn(client, {
        email: newcomer.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);

      const response = await client
        .patch('/v1/me')
        .field('name', 'Someone Else')
        .expect(403);

      expect(response.body).toMatchObject({ code: 'USERNAME_REQUIRED' });
      expect(revalidations()).toEqual([]);
    });
  });

  describe('changing the Name', () => {
    it('saves it trimmed and returns the current user', async () => {
      const before = await spec.client.get('/v1/me').expect(200);

      const response = await spec.client
        .patch('/v1/me')
        .field('name', '  Rear Admiral Grace Hopper  ')
        .expect(200);

      // Same user as `GET /v1/me`, with only the Name changed.
      expect(response.body).toEqual({
        ...before.body,
        name: 'Rear Admiral Grace Hopper',
      });
      expect(currentUserSchema.parse(response.body)).toEqual(response.body);
      expect(await nameInDatabase()).toBe('Rear Admiral Grace Hopper');
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toEqual(response.body);
    });

    it('accepts a Name of exactly the maximum length', async () => {
      const name = 'g'.repeat(NAME_MAX_LENGTH);

      const response = await spec.client
        .patch('/v1/me')
        .field('name', name)
        .expect(200);

      expect(response.body.name).toBe(name);
    });

    it('changes nothing but the Name, whatever else is sent', async () => {
      await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .field('username', 'admiral')
        .field('image', 'https://evil.example/tracker.png')
        .field('email', 'admiral@example.com')
        .field('role', 'ADMIN')
        .expect(200);

      const [row] = await spec.testApp.db
        .select()
        .from(users)
        .where(eq(users.id, user.id));
      expect(row).toMatchObject({
        name: 'Rear Admiral',
        username: 'grace',
        image: 'https://example.com/grace.png',
        email: 'grace@example.com',
        role: 'USER',
      });
    });

    it('enqueues the revalidation of the Profile page', async () => {
      await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .expect(200);

      expect(revalidations()).toEqual([
        {
          name: WEB_REVALIDATION_JOB,
          data: { tags: [cacheTags.userProfile('grace')] },
        },
      ]);
    });

    it('keeps a longer imported Name as it is until it is edited', async () => {
      const imported = 'g'.repeat(NAME_MAX_LENGTH + 50);
      await spec.testApp.db
        .update(users)
        .set({ name: imported })
        .where(eq(users.id, user.id));

      const me = await spec.client.get('/v1/me').expect(200);

      expect(me.body.name).toBe(imported);
    });
  });

  describe('invalid requests', () => {
    it.each([
      ['an empty Name', ''],
      ['a blank Name', '   '],
      ['a Name over the limit', 'g'.repeat(NAME_MAX_LENGTH + 1)],
    ])('rejects %s with VALIDATION_FAILED', async (_label, name) => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', name)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        details: { location: 'body' },
      });
      expect(await nameInDatabase()).toBe('Grace Hopper');
      expect(revalidations()).toEqual([]);
    });

    it('rejects a request without a Name with VALIDATION_FAILED', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('role', 'ADMIN')
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('rejects a form field far bigger than any Name', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', 'g'.repeat(20 * 1024))
        .expect(400);

      expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
      expect(await nameInDatabase()).toBe('Grace Hopper');
    });

    it('rejects a file part that is not the avatar', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .attach('photo', PNG, 'avatar.png')
        .expect(400);

      expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
      expect(await nameInDatabase()).toBe('Grace Hopper');
      expect(revalidations()).toEqual([]);
    });
  });
  describe('changing the Avatar', () => {
    const LEGACY_IMAGE = 'https://example.com/grace.png';

    const avatarKey = () => `avatars/${user.id}.webp`;
    const avatarUrl = () =>
      spec.testApp.app.get(StorageService).publicUrl(avatarKey());

    const imageInDatabase = async () => {
      const [row] = await spec.testApp.db
        .select({ image: users.image })
        .from(users)
        .where(eq(users.id, user.id));
      return row?.image;
    };

    /** The object served from the public files URL (404 when none). */
    const storedAvatar = async () => {
      const response = await fetch(avatarUrl());
      return {
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: Buffer.from(await response.arrayBuffer()),
      };
    };

    const cacheBustOf = (image: string | null | undefined) =>
      Number(new URL(image ?? '').searchParams.get('cacheBust'));

    const uploadAvatar = (
      file: Buffer,
      { name = 'Rear Admiral', filename = 'avatar.png' } = {},
    ) =>
      spec.client
        .patch('/v1/me')
        .field('name', name)
        .attach('avatar', file, { filename, contentType: 'image/png' });

    const expectNothingChanged = async () => {
      expect((await storedAvatar()).status).toBe(404);
      expect(await nameInDatabase()).toBe('Grace Hopper');
      expect(await imageInDatabase()).toBe(LEGACY_IMAGE);
      expect(revalidations()).toEqual([]);
    };

    it.each<ImageFormat>(['png', 'jpeg', 'webp'])(
      'stores a %s as a 512x512 webp without metadata and saves its URL',
      async (format) => {
        const photo = await createImage({
          format,
          metadata: { orientation: 1 },
        });
        expect((await describeImage(photo)).hasExif).toBe(true);

        const response = await uploadAvatar(photo, {
          name: '  Rear Admiral  ',
        }).expect(200);

        const url = new RegExp(
          `^${avatarUrl().replaceAll('.', '\\.')}\\?cacheBust=\\d+$`,
        );
        expect(response.body.image).toMatch(url);
        expect(response.body.name).toBe('Rear Admiral');
        expect(currentUserSchema.parse(response.body)).toEqual(response.body);
        expect(await imageInDatabase()).toBe(response.body.image);
        expect(await nameInDatabase()).toBe('Rear Admiral');
        const stored = await storedAvatar();
        expect(stored).toMatchObject({
          status: 200,
          contentType: 'image/webp',
        });
        expect(await describeImage(stored.body)).toMatchObject({
          format: 'webp',
          width: 512,
          height: 512,
          hasExif: false,
        });
        expect(revalidations()).toEqual([
          {
            name: WEB_REVALIDATION_JOB,
            data: { tags: [cacheTags.userProfile('grace')] },
          },
        ]);
      },
    );

    it('crops the picture around its center', async () => {
      const wide = await createImage({ width: 60, height: 20 });

      await uploadAvatar(wide).expect(200);

      const { body } = await storedAvatar();
      const stored = await describeImage(body);
      expect(isColor(stored.pixel(20, 256), 'green')).toBe(true);
      expect(isColor(stored.pixel(490, 256), 'green')).toBe(true);
    });

    it('overwrites the object on a second upload and changes the URL', async () => {
      const first = await uploadAvatar(await createImage()).expect(200);
      const before = await storedAvatar();

      const second = await uploadAvatar(
        await createImage({ format: 'jpeg', width: 60, height: 20 }),
      ).expect(200);
      const after = await storedAvatar();

      expect(after.status).toBe(200);
      expect(after.body.equals(before.body)).toBe(false);
      expect(second.body.image).not.toBe(first.body.image);
      expect(cacheBustOf(second.body.image)).toBeGreaterThan(
        cacheBustOf(first.body.image),
      );
      expect(await imageInDatabase()).toBe(second.body.image);
    });

    it('accepts a file of exactly the size limit', async () => {
      // Data after the end of a PNG is ignored by decoders.
      const png = await createImage();
      const padded = Buffer.concat([
        png,
        Buffer.alloc(AVATAR_MAX_BYTES - png.byteLength),
      ]);

      await uploadAvatar(padded).expect(200);

      expect((await storedAvatar()).status).toBe(200);
    });

    it('leaves the image as it is when only the Name changes', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .expect(200);

      expect(response.body.image).toBe(LEGACY_IMAGE);
      expect(await imageInDatabase()).toBe(LEGACY_IMAGE);
      expect((await storedAvatar()).status).toBe(404);
    });

    it.each([
      ['text with an image name and MIME type', Buffer.from('<html>hi</html>')],
      ['an empty file', Buffer.alloc(1)],
      ['a GIF', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1')],
      ['a PNG that ends after its signature', PNG.subarray(0, 8)],
    ])('rejects %s with VALIDATION_FAILED', async (_label, file) => {
      const response = await uploadAvatar(file).expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        details: {
          location: 'body',
          issues: [expect.objectContaining({ path: ['avatar'] })],
        },
      });
      await expectNothingChanged();
    });

    it('rejects a file over the size limit before storing anything', async () => {
      const tooBig = Buffer.alloc(AVATAR_MAX_BYTES + 1);

      const response = await uploadAvatar(tooBig).expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'body' },
      });
      await expectNothingChanged();
    });

    it('rejects an avatar sent as text instead of a file', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .field('avatar', 'https://evil.example/tracker.png')
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      await expectNothingChanged();
    });

    it('needs a session to upload', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .attach('avatar', await createImage(), 'avatar.png')
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
      await expectNothingChanged();
    });

    it('answers an error, and saves nothing, when the storage fails', async () => {
      const broken = await createTestApp({
        env: { S3_BUCKET: 'notefinder-missing-bucket' },
      });
      try {
        const client = createAuthClient(broken);
        await signIn(client, {
          email: user.email,
          password: DEFAULT_PASSWORD,
        }).expect(200);

        const response = await client
          .patch('/v1/me')
          .field('name', 'Rear Admiral')
          .attach('avatar', await createImage(), 'avatar.png')
          .expect(500);

        expect(response.body).toEqual({
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        });
        expect(broken.queues[WEB_REVALIDATION_QUEUE]?.added ?? []).toEqual([]);
        await expectNothingChanged();
      } finally {
        await broken.close();
      }
    });
  });
});
