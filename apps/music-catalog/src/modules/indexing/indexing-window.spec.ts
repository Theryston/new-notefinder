import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { DocumentBatch } from '../recording/recording-document.service.js';
import { runIndexingWindow } from './indexing-window.js';

const batch = (id: number): DocumentBatch => ({
  lastRecordingId: id,
  documents: [
    {
      mbid: `recording-${id}`,
      title: `Title ${id}`,
      artistCredit: 'Artist',
      artistAliases: [],
      releaseTitles: [],
      workTitles: [],
      genres: [],
      disambiguation: '',
    },
  ],
});

const pendingTask = () => {
  const resolvers = {
    resolve: (): void => undefined,
    reject: (_error: Error): void => undefined,
  };
  const promise = new Promise<void>((resolve, reject) => {
    resolvers.resolve = resolve;
    resolvers.reject = reject;
  });
  return { promise, ...resolvers };
};

const setup = () => {
  const controller = new AbortController();
  const tasks = Array.from({ length: 3 }, pendingTask);
  const documents = {
    findBatch: vi.fn(
      async (
        afterId: number,
        _size: number,
      ): Promise<DocumentBatch | undefined> => batch(afterId + 1),
    ),
  };
  let sent = 0;
  const index = {
    upsert: vi.fn((_documents: RecordingDocument[]) => {
      const task = tasks[sent++];
      if (task === undefined) throw new Error('Too many pending batches');
      return task.promise;
    }),
  };
  const confirm = vi.fn(async (_batch: DocumentBatch) => undefined);
  const run = () =>
    runIndexingWindow({
      afterId: 0,
      batchSize: 10_000,
      signal: controller.signal,
      documents,
      index,
      confirm,
    });
  return { controller, tasks, documents, index, confirm, run };
};

describe('runIndexingWindow', () => {
  it('stops submission if an earlier task fails while the next batch loads', async () => {
    const { run, tasks, index, documents, confirm } = setup();
    const loading = pendingTask();
    documents.findBatch
      .mockResolvedValueOnce(batch(1))
      .mockImplementationOnce(async () => {
        await loading.promise;
        return batch(2);
      });
    const running = run();
    const rejected = expect(running).rejects.toThrow('earlier task failed');
    await vi.waitFor(() =>
      expect(documents.findBatch).toHaveBeenCalledTimes(2),
    );
    tasks[0]?.reject(new Error('earlier task failed'));
    loading.resolve();
    await rejected;
    expect(index.upsert).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('overlaps preparation and indexing, with at most three pending batches', async () => {
    const { run, tasks, index, documents, confirm } = setup();
    const running = run();
    await vi.waitFor(() => expect(index.upsert).toHaveBeenCalledTimes(3));
    expect(documents.findBatch.mock.calls).toEqual([
      [0, 10_000],
      [1, 10_000],
      [2, 10_000],
    ]);
    expect(confirm).not.toHaveBeenCalled();
    for (const task of tasks) task.resolve();
    await expect(running).resolves.toEqual({ afterId: 3, exhausted: false });
    expect(confirm.mock.calls.map(([item]) => item.lastRecordingId)).toEqual([
      1, 2, 3,
    ]);
  });

  it('confirms in source order even when later tasks finish first', async () => {
    const { run, tasks, index, confirm } = setup();
    const running = run();
    await vi.waitFor(() => expect(index.upsert).toHaveBeenCalledTimes(3));
    tasks[2]?.resolve();
    tasks[1]?.resolve();
    await Promise.resolve();
    expect(confirm).not.toHaveBeenCalled();
    tasks[0]?.resolve();
    await running;
    expect(confirm.mock.calls.map(([item]) => item.lastRecordingId)).toEqual([
      1, 2, 3,
    ]);
  });

  it('never checkpoints beyond a failed batch and drains later writes before rejecting', async () => {
    const { run, tasks, index, confirm } = setup();
    const running = run();
    const rejected = expect(running).rejects.toThrow('batch failed');
    let settled = false;
    void running.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await vi.waitFor(() => expect(index.upsert).toHaveBeenCalledTimes(3));
    tasks[1]?.reject(new Error('batch failed'));
    tasks[0]?.resolve();
    await vi.waitFor(() =>
      expect(confirm).toHaveBeenCalledExactlyOnceWith(batch(1)),
    );
    expect(settled).toBe(false);
    tasks[2]?.resolve();
    await rejected;
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('drains sent tasks and confirms them after a source read fails', async () => {
    const { run, tasks, documents, index, confirm } = setup();
    documents.findBatch
      .mockResolvedValueOnce(batch(1))
      .mockRejectedValueOnce(new Error('read failed'));
    const running = run();
    const rejected = expect(running).rejects.toThrow('read failed');
    await vi.waitFor(() => expect(index.upsert).toHaveBeenCalledTimes(1));
    tasks[0]?.resolve();
    await rejected;
    expect(confirm).toHaveBeenCalledExactlyOnceWith(batch(1));
    expect(index.upsert).toHaveBeenCalledTimes(1);
  });

  it('drains writes after a checkpoint fails without confirming later batches', async () => {
    const { run, tasks, index, confirm } = setup();
    confirm.mockRejectedValueOnce(new Error('checkpoint failed'));
    const running = run();
    const rejected = expect(running).rejects.toThrow('checkpoint failed');
    await vi.waitFor(() => expect(index.upsert).toHaveBeenCalledTimes(3));
    for (const task of tasks) task.resolve();
    await rejected;
    expect(confirm).toHaveBeenCalledExactlyOnceWith(batch(1));
  });

  it('stops admitting batches on abort and waits for those already sent', async () => {
    const { run, tasks, index, controller, confirm } = setup();
    const running = run();
    await vi.waitFor(() => expect(index.upsert).toHaveBeenCalledTimes(3));
    controller.abort();
    for (const task of tasks) task.resolve();
    await running;
    expect(index.upsert).toHaveBeenCalledTimes(3);
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('does not submit a batch loaded after cancellation', async () => {
    const { run, documents, index, controller } = setup();
    documents.findBatch.mockImplementationOnce(async () => {
      controller.abort();
      return batch(1);
    });
    await expect(run()).resolves.toEqual({ afterId: 0, exhausted: false });
    expect(index.upsert).not.toHaveBeenCalled();
  });

  it('starts no source read if already aborted', async () => {
    const { run, documents, controller } = setup();
    controller.abort();
    await expect(run()).resolves.toEqual({ afterId: 0, exhausted: false });
    expect(documents.findBatch).not.toHaveBeenCalled();
  });

  it('reports the end of the source only after confirming pending batches', async () => {
    const { run, tasks, index, documents, confirm } = setup();
    documents.findBatch
      .mockResolvedValueOnce(batch(1))
      .mockResolvedValueOnce(undefined);
    const running = run();
    await vi.waitFor(() => expect(index.upsert).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
    tasks[0]?.resolve();
    await expect(running).resolves.toEqual({ afterId: 1, exhausted: true });
    expect(confirm).toHaveBeenCalledExactlyOnceWith(batch(1));
  });
});
