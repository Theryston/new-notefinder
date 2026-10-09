import {
  isPipelineStep,
  isStepDue,
  nextPipelineStep,
  resumeStepOf,
} from './track-pipeline-steps.js';

// The note detection's two stages in the pipeline: the vocals stage follows the
// download, the notes stage is the last of this build, and a failure in either
// resumes at the vocals, since a retry starts the RunPod job again.

describe('note detection in the pipeline', () => {
  it('runs the vocals stage after the download and the notes stage after it', () => {
    expect(isPipelineStep('EXTRACTING_VOCALS')).toBe(true);
    expect(isPipelineStep('DETECTING_NOTES')).toBe(true);
    expect(nextPipelineStep('DOWNLOADING_AUDIO')).toBe('EXTRACTING_VOCALS');
    expect(nextPipelineStep('EXTRACTING_VOCALS')).toBe('DETECTING_NOTES');
  });

  it('runs a queued Processing and a replayed job of the notes stage', () => {
    expect(isStepDue('QUEUED', 'DETECTING_NOTES')).toBe(true);
    expect(isStepDue('DETECTING_NOTES', 'DETECTING_NOTES')).toBe(true);
  });

  it('skips a note detection job of a Processing that already completed', () => {
    expect(isStepDue('COMPLETED', 'DETECTING_NOTES')).toBe(false);
    expect(isStepDue('COMPLETED', 'EXTRACTING_VOCALS')).toBe(false);
  });

  it('resumes a failed notes stage at the vocals stage, so the job starts again', () => {
    expect(resumeStepOf('DETECTING_NOTES')).toBe('EXTRACTING_VOCALS');
  });

  it('resumes any other failure at the step it failed in', () => {
    expect(resumeStepOf('EXTRACTING_VOCALS')).toBe('EXTRACTING_VOCALS');
    expect(resumeStepOf('DOWNLOADING_AUDIO')).toBe('DOWNLOADING_AUDIO');
    expect(resumeStepOf('FINDING_VIDEO')).toBe('FINDING_VIDEO');
  });
});
