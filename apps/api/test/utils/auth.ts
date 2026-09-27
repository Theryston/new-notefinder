import request from 'supertest';
import {
  EMAIL_QUEUE,
  type EmailMessage,
  emailMessageSchema,
} from '../../src/integrations/email/email.job.js';
import { OTP_LENGTH } from '../../src/modules/auth/auth.constants.js';
import type { FakeQueue } from '../redis-test-overrides.js';
import type { TestApp } from './create-test-app.js';

/**
 * A trusted web origin (the env default). Better Auth rejects cookie-bearing
 * requests from other origins as CSRF, so every auth client sends it.
 */
export const TEST_WEB_ORIGIN = 'http://localhost:3000';

/** Name of Better Auth's session cookie (`cookiePrefix` + `.session_token`). */
export const SESSION_COOKIE = 'notefinder.session_token';

export type AuthClient = ReturnType<typeof request.agent>;

/**
 * A fresh supertest agent (its own cookie jar, so its own session) that sends
 * the trusted web `Origin` like the browser does.
 */
export const createAuthClient = (testApp: TestApp): AuthClient =>
  request.agent(testApp.app.getHttpServer()).set('Origin', TEST_WEB_ORIGIN);

/** Value of the session cookie set by a response, if any. */
export const sessionCookieFrom = (
  response: request.Response,
): string | undefined => {
  const header: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [];
  for (const cookie of cookies) {
    if (typeof cookie !== 'string') continue;
    const [pair = ''] = cookie.split(';');
    const separator = pair.indexOf('=');
    if (pair.slice(0, separator) === SESSION_COOKIE) {
      return pair.slice(separator + 1);
    }
  }
  return undefined;
};

export type CapturedEmail = EmailMessage & {
  /** The one-time code in the email body. */
  otp: string;
};

const EMAIL_WAIT_MS = 2_000;
const EMAIL_POLL_MS = 10;

const emailQueue = (testApp: TestApp): FakeQueue => {
  const queue = testApp.queues[EMAIL_QUEUE];
  if (!queue) {
    throw new Error(`No fake "${EMAIL_QUEUE}" queue`);
  }
  return queue;
};

const OTP_LINE = new RegExp(`^\\d{${OTP_LENGTH}}$`, 'm');

const takeQueuedEmail = (
  queue: FakeQueue,
  to: string,
): CapturedEmail | undefined => {
  const index = queue.added.findIndex(
    (job) => emailMessageSchema.safeParse(job.data).data?.to === to,
  );
  const job = queue.added[index];
  if (!job) return undefined;
  queue.added.splice(index, 1);
  const message = emailMessageSchema.parse(job.data);
  const otp = OTP_LINE.exec(message.text)?.[0];
  if (otp === undefined) {
    throw new Error(`No ${OTP_LENGTH}-digit code in the email to ${to}`);
  }
  return { ...message, otp };
};

/** Forgets every email enqueued so far. */
export const clearEmails = (testApp: TestApp): void => {
  emailQueue(testApp).added.length = 0;
};

/**
 * Removes and returns the oldest code email enqueued for `to`. Better Auth
 * enqueues it without awaiting (so the response can't reveal it), hence the
 * polling.
 */
export const takeOtpEmail = async (
  testApp: TestApp,
  to: string,
): Promise<CapturedEmail> => {
  const queue = emailQueue(testApp);
  const deadline = Date.now() + EMAIL_WAIT_MS;
  for (;;) {
    const email = takeQueuedEmail(queue, to);
    if (email) return email;
    if (Date.now() > deadline) {
      throw new Error(`No email to ${to} within ${EMAIL_WAIT_MS}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, EMAIL_POLL_MS));
  }
};

/** Emails enqueued for `to` so far, after letting pending sends settle. */
export const countEmailsTo = async (
  testApp: TestApp,
  to: string,
): Promise<number> => {
  await new Promise((resolve) => setTimeout(resolve, EMAIL_POLL_MS * 10));
  return emailQueue(testApp).added.filter(
    (job) => emailMessageSchema.safeParse(job.data).data?.to === to,
  ).length;
};

export type Credentials = { email: string; password: string };

export const signUp = (
  client: AuthClient,
  body: Credentials & { name: string },
) => client.post('/v1/auth/sign-up/email').send(body);

export const signIn = (client: AuthClient, body: Credentials) =>
  client.post('/v1/auth/sign-in/email').send(body);

export const signInWithUsername = (
  client: AuthClient,
  body: { username: string; password: string },
) => client.post('/v1/auth/sign-in/username').send(body);

export const verifyEmail = (
  client: AuthClient,
  body: { email: string; otp: string },
) => client.post('/v1/auth/email-otp/verify-email').send(body);

/**
 * Signs up, verifies the email with the captured code and leaves `client`
 * signed in.
 */
export const signUpVerified = async (
  testApp: TestApp,
  client: AuthClient,
  body: Credentials & { name: string },
): Promise<void> => {
  await signUp(client, body).expect(200);
  const { otp } = await takeOtpEmail(testApp, body.email);
  await verifyEmail(client, { email: body.email, otp }).expect(200);
};
