import type { RecordingDocumentRepository } from './recording-document.repository.js';
import { RecordingDocumentService } from './recording-document.service.js';
import type { DocumentRecordingRow } from './recording-document-data.js';

const row = (id: number): DocumentRecordingRow => ({
  id,
  mbid: `mbid-${id}`,
  title: `Title ${id}`,
  disambiguation: '',
  artistCreditId: id + 100,
  artistCreditName: `Artist ${id}`,
});

const setup = (rows: DocumentRecordingRow[]) => {
  const repository = {
    findBatch: vi.fn(async () => []),
    findByIds: vi.fn(async () => rows),
    findArtistNames: vi.fn(async () => []),
    findReleaseTitles: vi.fn(async () => []),
    findWorkTitles: vi.fn(async () => []),
    findRecordingGenres: vi.fn(async () => []),
    findReleaseGroupGenres: vi.fn(async () => []),
    findArtistGenres: vi.fn(async () => []),
  };
  const service = new RecordingDocumentService(
    repository as unknown as RecordingDocumentRepository,
  );
  return { service, repository };
};

describe('RecordingDocumentService.findDocumentsByIds', () => {
  it('builds the document of every Recording that still exists, paired with its id and MBID', async () => {
    const { service, repository } = setup([row(11), row(12)]);

    const found = await service.findDocumentsByIds([11, 12, 13]);

    expect(repository.findByIds).toHaveBeenCalledExactlyOnceWith([11, 12, 13]);
    expect(found).toMatchObject([
      { id: 11, mbid: 'mbid-11', document: { mbid: 'mbid-11' } },
      { id: 12, mbid: 'mbid-12', document: { mbid: 'mbid-12' } },
    ]);
  });

  it('finds nothing without asking for anything', async () => {
    const { service, repository } = setup([]);

    await expect(service.findDocumentsByIds([])).resolves.toEqual([]);
    expect(repository.findByIds).toHaveBeenCalledExactlyOnceWith([]);
  });
});
