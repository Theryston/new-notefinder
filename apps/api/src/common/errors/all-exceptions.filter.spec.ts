import {
  type ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { apiErrorSchema } from '@notefinder/contracts';
import { z } from 'zod';
import { ZodSerializationException } from '../zod/zod-serializer.interceptor.js';
import { ZodValidationException } from '../zod/zod-validation.pipe.js';
import { AllExceptionsFilter, toApiError } from './all-exceptions.filter.js';
import { API_ERROR_HTTP_STATUS, AppException } from './app-exception.js';

describe('AppException', () => {
  it.each(Object.entries(API_ERROR_HTTP_STATUS))(
    'maps %s to HTTP %i',
    (code, status) => {
      const exception = new AppException(
        apiErrorSchema.shape.code.parse(code),
        'message',
      );
      expect(exception.getStatus()).toBe(status);
      expect(exception.toApiError()).toEqual({
        statusCode: status,
        code,
        message: 'message',
      });
    },
  );

  it('keeps details in the envelope', () => {
    const exception = new AppException('CONFLICT', 'Taken', { field: 'x' });
    expect(exception.toApiError().details).toEqual({ field: 'x' });
  });
});

describe('toApiError', () => {
  it('converts an AppException', () => {
    const { error, shouldLog } = toApiError(
      new AppException('NOT_FOUND', 'Track not found'),
    );
    expect(error).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Track not found',
    });
    expect(shouldLog).toBe(false);
  });

  it('converts a Zod validation error with its issues', () => {
    const result = z.object({ limit: z.number() }).safeParse({ limit: 'x' });
    if (result.success) {
      throw new Error('expected the parse to fail');
    }
    const { error } = toApiError(
      new ZodValidationException(result.error, 'query'),
    );
    expect(error).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: {
        location: 'query',
        issues: [expect.objectContaining({ path: ['limit'] })],
      },
    });
    expect(apiErrorSchema.safeParse(error).success).toBe(true);
  });

  it.each([
    [new BadRequestException('Bad'), 400, 'BAD_REQUEST'],
    [new ForbiddenException(), 403, 'FORBIDDEN'],
    [new NotFoundException('Cannot GET /nope'), 404, 'NOT_FOUND'],
    [
      new HttpException('Too many', HttpStatus.TOO_MANY_REQUESTS),
      429,
      'RATE_LIMITED',
    ],
    [new HttpException('Gone', HttpStatus.GONE), 410, 'BAD_REQUEST'],
  ])('maps Nest HttpException %#', (exception, statusCode, code) => {
    const { error } = toApiError(exception);
    expect(error).toEqual({ statusCode, code, message: exception.message });
  });

  it('hides the message of 5xx HttpExceptions', () => {
    const { error, shouldLog } = toApiError(
      new ServiceUnavailableException('db pool exhausted'),
    );
    expect(error).toEqual({
      statusCode: 503,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(shouldLog).toBe(true);
  });

  it('maps exposed http-errors (e.g. malformed JSON body)', () => {
    const bodyParserError = Object.assign(new SyntaxError('Unexpected token'), {
      statusCode: 400,
      expose: true,
    });
    expect(toApiError(bodyParserError).error).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Unexpected token',
    });
  });

  it.each([
    new Error('secret connection string'),
    new ZodSerializationException(new z.ZodError([])),
    'a thrown string',
    Object.assign(new Error('not exposed'), { statusCode: 400 }),
  ])('never leaks unknown errors %#', (exception) => {
    const { error, shouldLog } = toApiError(exception);
    expect(error).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(shouldLog).toBe(true);
  });
});

describe('AllExceptionsFilter', () => {
  const createHost = (response: object): ArgumentsHost =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => response }),
    }) as unknown as ArgumentsHost;

  const createFilter = (headersSent = false) => {
    const httpAdapter = {
      reply: vi.fn(),
      end: vi.fn(),
      isHeadersSent: vi.fn(() => headersSent),
    };
    const filter = new AllExceptionsFilter({
      httpAdapter,
    } as unknown as HttpAdapterHost);
    return { filter, httpAdapter };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replies with the envelope and its status code', () => {
    const { filter, httpAdapter } = createFilter();
    const response = {};
    filter.catch(new AppException('FORBIDDEN', 'Nope'), createHost(response));
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      { statusCode: 403, code: 'FORBIDDEN', message: 'Nope' },
      403,
    );
  });

  it('logs unknown errors', () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { filter, httpAdapter } = createFilter();
    const boom = new Error('boom');
    filter.catch(boom, createHost({}));
    expect(logSpy).toHaveBeenCalledWith('boom', boom.stack);
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      500,
    );
  });

  it('only ends the response when headers were already sent', () => {
    const { filter, httpAdapter } = createFilter(true);
    filter.catch(new NotFoundException(), createHost({}));
    expect(httpAdapter.end).toHaveBeenCalled();
    expect(httpAdapter.reply).not.toHaveBeenCalled();
  });
});
