import { Test, type TestingModule } from '@nestjs/testing';
import { ENV } from '../../config/env.js';
import { EmailService } from '../../integrations/email/email.service.js';
import { UsersService } from '../users/users.service.js';
import { TrackContributorEmailsService } from './track-contributor-emails.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';

// The emails of a Processing that ended: who is emailed, in which language, and
// that a failing email never fails the Processing (nothing is thrown).

const processings = {
  claimContributorEmails: vi.fn(),
  findContributors: vi.fn(),
};
const users = { findEmailRecipients: vi.fn() };
const emails = {
  sendTrackCompleted: vi.fn(),
  sendTrackFailed: vi.fn(),
};
const env = { WEB_URL: 'https://notefinder.test' };

const ended = (status: 'COMPLETED' | 'FAILED' = 'COMPLETED') => ({
  trackId: 'track-1',
  status,
});

const recipients = new Map([
  ['ana', { id: 'ana', email: 'ana@example.com', locale: 'pt-BR' }],
  ['bob', { id: 'bob', email: 'bob@example.com', locale: 'en' }],
]);

describe('TrackContributorEmailsService', () => {
  let service: TrackContributorEmailsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    processings.claimContributorEmails.mockResolvedValue(ended());
    processings.findContributors.mockResolvedValue([
      { id: 'c1', userId: 'ana' },
      { id: 'c2', userId: 'bob' },
    ]);
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

  it('emails every Contributor of a completed Processing in their own language, with the Track link', async () => {
    await service.notifyIfEnded('processing-1');

    expect(processings.claimContributorEmails).toHaveBeenCalledWith(
      'processing-1',
    );
    expect(users.findEmailRecipients).toHaveBeenCalledWith(['ana', 'bob']);
    expect(emails.sendTrackCompleted).toHaveBeenCalledWith({
      to: 'ana@example.com',
      locale: 'pt-BR',
      trackUrl: 'https://notefinder.test/pt-BR/tracks/track-1',
    });
    expect(emails.sendTrackCompleted).toHaveBeenCalledWith({
      to: 'bob@example.com',
      locale: 'en',
      trackUrl: 'https://notefinder.test/en/tracks/track-1',
    });
    expect(emails.sendTrackFailed).not.toHaveBeenCalled();
  });

  it('sends the failed email when the Processing failed', async () => {
    processings.claimContributorEmails.mockResolvedValue(ended('FAILED'));

    await service.notifyIfEnded('processing-1');

    expect(emails.sendTrackFailed).toHaveBeenCalledTimes(2);
    expect(emails.sendTrackCompleted).not.toHaveBeenCalled();
  });

  it('sends nothing while the Processing is still running, or its emails were claimed', async () => {
    processings.claimContributorEmails.mockResolvedValue(undefined);

    await service.notifyIfEnded('processing-1');

    expect(processings.findContributors).not.toHaveBeenCalled();
    expect(emails.sendTrackCompleted).not.toHaveBeenCalled();
    expect(emails.sendTrackFailed).not.toHaveBeenCalled();
  });

  it('keeps emailing the other Contributors when one email is refused', async () => {
    emails.sendTrackCompleted
      .mockRejectedValueOnce(new Error('bad address'))
      .mockResolvedValueOnce(undefined);

    await expect(
      service.notifyIfEnded('processing-1'),
    ).resolves.toBeUndefined();

    expect(emails.sendTrackCompleted).toHaveBeenCalledTimes(2);
  });

  it('never throws, even when the claim itself fails', async () => {
    processings.claimContributorEmails.mockRejectedValue(
      new Error('database is down'),
    );

    await expect(
      service.notifyIfEnded('processing-1'),
    ).resolves.toBeUndefined();
    expect(emails.sendTrackCompleted).not.toHaveBeenCalled();
  });
});
