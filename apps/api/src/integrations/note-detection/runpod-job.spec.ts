import { runpodJobIdOf, runpodJobStateOf } from './runpod-job.js';

describe('runpodJobIdOf', () => {
  it('answers the ID of the job a /run started', () => {
    expect(runpodJobIdOf({ id: 'job-1', status: 'IN_QUEUE' })).toBe('job-1');
  });

  it('refuses an answer with no job ID', () => {
    expect(() => runpodJobIdOf({ status: 'IN_QUEUE' })).toThrow();
  });
});

describe('runpodJobStateOf', () => {
  it('reads a queued job as running, at no stage yet', () => {
    expect(runpodJobStateOf({ id: 'job-1', status: 'IN_QUEUE' })).toEqual({
      kind: 'running',
      stage: undefined,
    });
  });

  it('reads the stage a running job reported as its progress update', () => {
    expect(
      runpodJobStateOf({
        id: 'job-1',
        status: 'IN_PROGRESS',
        output: 'EXTRACTING_VOCALS',
      }),
    ).toEqual({ kind: 'running', stage: 'EXTRACTING_VOCALS' });
    expect(
      runpodJobStateOf({
        id: 'job-1',
        status: 'IN_PROGRESS',
        output: 'DETECTING_NOTES',
      }),
    ).toEqual({ kind: 'running', stage: 'DETECTING_NOTES' });
  });

  it('reads a running job whose progress names no known stage as running at no stage', () => {
    expect(
      runpodJobStateOf({
        id: 'job-1',
        status: 'IN_PROGRESS',
        output: { percent: 40 },
      }),
    ).toEqual({ kind: 'running', stage: undefined });
  });

  it('reads a status RunPod adds later as still running', () => {
    expect(runpodJobStateOf({ id: 'job-1', status: 'RETRIED' })).toEqual({
      kind: 'running',
      stage: undefined,
    });
  });

  it('answers the worker output of a completed job', () => {
    const output = { vocalsUrl: 'https://files.test/vocals.wav', notes: [] };

    expect(
      runpodJobStateOf({ id: 'job-1', status: 'COMPLETED', output }),
    ).toEqual({ kind: 'completed', output });
  });

  it.each(['FAILED', 'CANCELLED', 'TIMED_OUT'])(
    'reads a %s job as failed',
    (status) => {
      expect(runpodJobStateOf({ id: 'job-1', status })).toEqual({
        kind: 'failed',
      });
    },
  );

  it('refuses an answer with no status', () => {
    expect(() => runpodJobStateOf({ id: 'job-1' })).toThrow();
  });
});
