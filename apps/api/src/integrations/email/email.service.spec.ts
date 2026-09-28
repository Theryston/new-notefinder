import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ZodError } from 'zod';
import { EMAIL_JOB, EMAIL_QUEUE } from './email.job.js';
import { EmailService } from './email.service.js';

describe('EmailService', () => {
  let service: EmailService;
  const queue = { add: vi.fn() };

  beforeEach(async () => {
    queue.add.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getQueueToken(EMAIL_QUEUE), useValue: queue },
      ],
    }).compile();
    service = moduleRef.get(EmailService);
  });

  it('enqueues the message without keeping it after delivery', async () => {
    const message = {
      to: 'ana@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    };
    await service.send(message);
    expect(queue.add).toHaveBeenCalledWith(
      EMAIL_JOB,
      message,
      expect.objectContaining({ removeOnComplete: true }),
    );
  });

  it('rejects invalid messages', async () => {
    await expect(
      service.send({ to: 'nope', subject: 'Hi', html: 'x', text: 'x' }),
    ).rejects.toThrow(ZodError);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('renders and enqueues code emails in the requested locale', async () => {
    await service.sendOtp({
      to: 'ana@example.com',
      type: 'forget-password',
      otp: '654321',
      locale: 'pt-BR',
      expiresInMinutes: 10,
    });
    expect(queue.add).toHaveBeenCalledWith(
      EMAIL_JOB,
      expect.objectContaining({
        to: 'ana@example.com',
        subject: 'Seu código para redefinir a senha do notefinder',
        text: expect.stringContaining('654321'),
      }),
      expect.any(Object),
    );
  });

  it('renders and enqueues account-exists emails in the requested locale', async () => {
    await service.sendAccountExists({ to: 'ana@example.com', locale: 'en' });
    expect(queue.add).toHaveBeenCalledWith(
      EMAIL_JOB,
      expect.objectContaining({
        to: 'ana@example.com',
        subject: 'You already have a notefinder account',
      }),
      expect.any(Object),
    );
  });
});
