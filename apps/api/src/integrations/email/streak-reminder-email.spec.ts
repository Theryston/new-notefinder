import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ENV } from '../../config/env.js';
import { EMAIL_QUEUE } from './email.job.js';
import { EmailService } from './email.service.js';
import { renderStreakReminderEmail } from './streak-reminder-email.js';

describe('Practice reminder email', () => {
  it.each([
    ['en', 'Keep your practice streak on vozzify', 'Start practicing'],
    [
      'pt-BR',
      'Mantenha sua sequência de prática no vozzify',
      'Começar a praticar',
    ],
  ] as const)(
    'uses the shared layout and %s copy',
    (locale, subject, action) => {
      const email = renderStreakReminderEmail({
        to: 'user@example.com',
        locale,
        siteUrl: `https://vozzify.test/${locale}?a=1&b=2`,
        webUrl: 'https://vozzify.test',
      });
      expect(email.subject).toBe(subject);
      expect(email.text).toContain(action);
      expect(email.text).toContain(`https://vozzify.test/${locale}?a=1&b=2`);
      expect(email.html).toContain(`<html lang="${locale}">`);
      expect(email.html).toContain(
        `href="https://vozzify.test/${locale}?a=1&amp;b=2"`,
      );
    },
  );
  it('retains delivered reminder jobs to deduplicate a replay after DB commit failure', async () => {
    const add = vi.fn();
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getQueueToken(EMAIL_QUEUE), useValue: { add } },
        { provide: ENV, useValue: { WEB_URL: 'https://vozzify.test' } },
      ],
    }).compile();
    await module.get(EmailService).send(
      renderStreakReminderEmail({
        to: 'user@example.com',
        locale: 'en',
        siteUrl: 'https://vozzify.test/en',
        webUrl: 'https://vozzify.test',
      }),
      { jobId: 'reminder-user-day', retainForSeconds: 172800 },
    );
    expect(add).toHaveBeenCalledWith(
      'send',
      expect.any(Object),
      expect.objectContaining({
        jobId: 'reminder-user-day',
        removeOnComplete: { age: 172800 },
      }),
    );
    await module.close();
  });
});
