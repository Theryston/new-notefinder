import { Test } from '@nestjs/testing';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { TrackNotesRepository } from './track-notes.repository.js';
import { TrackNotesService } from './track-notes.service.js';
import { TracksRepository } from './tracks.repository.js';

const notes = { replaceNotes: vi.fn() };
const tracks = { setNoteSummary: vi.fn() };

describe('TrackNotesService', () => {
  let service: TrackNotesService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { db, pool } = fakeTransactionalDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        TrackNotesService,
        { provide: TrackNotesRepository, useValue: notes },
        { provide: TracksRepository, useValue: tracks },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(TrackNotesService);
  });

  it('replaces the notes and stores the vocal range and key they give', async () => {
    const sung = [67, 69, 71, 72, 74, 76, 78, 67, 67, 74].map(
      (pitch, index) => ({ pitch, start: index, end: index + 1 }),
    );

    await service.replaceNotes('track-1', sung);

    expect(notes.replaceNotes).toHaveBeenCalledWith('track-1', sung);
    expect(tracks.setNoteSummary).toHaveBeenCalledWith('track-1', {
      vocalRangeLowest: 67,
      vocalRangeHighest: 78,
      keyTonic: 7,
      keyMode: 'MAJOR',
    });
  });

  it('clears the summary when the Track has no notes', async () => {
    await service.replaceNotes('track-1', []);

    expect(notes.replaceNotes).toHaveBeenCalledWith('track-1', []);
    expect(tracks.setNoteSummary).toHaveBeenCalledWith('track-1', {
      vocalRangeLowest: null,
      vocalRangeHighest: null,
      keyTonic: null,
      keyMode: null,
    });
  });
});
