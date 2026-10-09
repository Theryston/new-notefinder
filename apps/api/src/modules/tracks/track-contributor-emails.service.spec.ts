import { Test, type TestingModule } from '@nestjs/testing';
import { ENV } from '../../config/env.js';
import { EmailService } from '../../integrations/email/email.service.js';
import { UsersService } from '../users/users.service.js';
import { TrackContributorEmailsService } from './track-contributor-emails.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';

// Who is emailed when a Processing ends, in which language, under which job ID,
// and what a failure leaves behind: the round is replayed, never skipped.

const processings = {
  findEndedWithoutEmails: vi.fn(),
  findContributors: vi.fn(),
  markContributorsEmailed: vi.fn(),
};
const users = { findEmailRecipients: vi.fn() };
const emails = {
  sendTrackCompleted: vi.fn(),
  sendTrackFailed: vi.fn(),
};
const env = { WEB_URL: 'https://notefinder.test' };

const recipients = new Map([
  ['ana', { id: 'ana', email: 'ana@example.com', locale: 'pt-BR' }],
  ['bob', { id: 'bob', email: 'bob@example.com', locale: 'en' }],
]);

describe('TrackContributorEmailsService', () => {
  let service: TrackContributorEmailsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    processings.findEndedWithoutEmails.mockResolvedValue({
      trackId: 'track-1',
      status: 'COMPLETED',
    });
    processings.findContributors.mockResolvedValue([
      { id: 'c1', userId: 'ana' },
      { id: 'c2', userId: 'bob' },
    ]);
    processings.markContributorsEmailed.mockResolvedValue(undefined);
    users.findEmailRecipients.mockResolvedValue(recipients);
    emails.sendTrackCompleted.mockResolvedValue(undefined);
    emails.sendTrackFailed.mockResolvedValue(undefined);
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TrackContributorEmailsService,
        { provide: ENV, useValue: env },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: UsersService, useValue: users },
        { provide: EmailService, useValue: emails },
      ],
    }).compile();
    service = moduleRef.get(TrackContributorEmailsService);
  });

  it('queues each Contributor email in their own language, under a job ID per Processing and User', async () => {
    await service.notifyIfEnded('processing-1');

    expect(users.findEmailRecipients).toHaveBeenCalledWith(['ana', 'bob']);
    expect(emails.sendTrackCompleted).toHaveBeenCalledWith(
      {
        to: 'ana@example.com',
        locale: 'pt-BR',
        trackUrl: 'https://notefinder.test/pt-BR/tracks/track-1',
      },
      { jobId: 'track-email-processing-1-ana' },
    );
    expect(emails.sendTrackCompleted).toHaveBeenCalledWith(
      {
        to: 'bob@example.com',
        locale: 'en',
        trackUrl: 'https://notefinder.test/en/tracks/track-1',
      },
      { jobId: 'track-email-processing-1-bob' },
    );
    expect(emails.sendTrackFailed).not.toHaveBeenCalled();
  });

  it('marks the Processing emailed only after every email was queued', async () => {
    await service.notifyIfEnded('processing-1');

    expect(processings.markContributorsEmailed).toHaveBeenCalledWith(
      'processing-1',
    );
  });

  it('sends the failed email when the Processing failed', async () => {
    processings.findEndedWithoutEmails.mockResolvedValue({
      trackId: 'track-1',
      status: 'FAILED',
    });

    await service.notifyIfEnded('processing-1');

    expect(emails.sendTrackFailed).toHaveBeenCalledTimes(2);
    expect(emails.sendTrackCompleted).not.toHaveBeenCalled();
  });

  it('does nothing while the Processing runs, or once its emails were queued', async () => {
    processings.findEndedWithoutEmails.mockResolvedValue(undefined);

    await service.notifyIfEnded('processing-1');

    expect(processings.findContributors).not.toHaveBeenCalled();
    expect(emails.sendTrackCompleted).not.toHaveBeenCalled();
    expect(processings.markContributorsEmailed).not.toHaveBeenCalled();
  });

  it('fails, and does not mark the Processing, when the recipients cannot be read', async () => {
    users.findEmailRecipients.mockRejectedValue(new Error('database is down'));

    await expect(service.notifyIfEnded('processing-1')).rejects.toThrow(
      'database is down',
    );

    expect(emails.sendTrackCompleted).not.toHaveBeenCalled();
    expect(processings.markContributorsEmailed).not.toHaveBeenCalled();
  });

  it('still queues the other emails when one is refused, then fails without marking', async () => {
    emails.sendTrackCompleted
      .mockRejectedValueOnce(new Error('Redis is down'))
      .mockResolvedValueOnce(undefined);

    await expect(service.notifyIfEnded('processing-1')).rejects.toThrow(
      '1 of 2 Contributor emails were not queued: Redis is down',
    );

    expect(emails.sendTrackCompleted).toHaveBeenCalledTimes(2);
    expect(processings.markContributorsEmailed).not.toHaveBeenCalled();
  });
});
