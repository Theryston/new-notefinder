import {
  dueStatusesOf,
  firstPipelineStep,
  isPipelineStep,
  isStepDue,
  nextPipelineStep,
} from './track-pipeline-steps.js';

describe('track pipeline steps', () => {
  it('starts with finding the video', () => {
    expect(firstPipelineStep()).toBe('FINDING_VIDEO');
  });

  it('has no step after the last one that exists', () => {
    expect(nextPipelineStep('FINDING_VIDEO')).toBe('DOWNLOADING_AUDIO');
    expect(nextPipelineStep('DOWNLOADING_AUDIO')).toBe('EXTRACTING_VOCALS');
    expect(nextPipelineStep('DETECTING_NOTES')).toBe('EXTRACTING_LYRICS');
    expect(nextPipelineStep('EXTRACTING_LYRICS')).toBeUndefined();
  });

  it('runs only the steps of this build', () => {
    expect(isPipelineStep('FINDING_VIDEO')).toBe(true);
    expect(isPipelineStep('DOWNLOADING_AUDIO')).toBe(true);
    expect(isPipelineStep('EXTRACTING_VOCALS')).toBe(true);
    expect(isPipelineStep('DETECTING_NOTES')).toBe(true);
    expect(isPipelineStep('EXTRACTING_LYRICS')).toBe(true);
  });

  it('may run a step from queued or from the step itself', () => {
    expect(dueStatusesOf('FINDING_VIDEO')).toEqual(['QUEUED', 'FINDING_VIDEO']);
  });

  it('runs a queued Processing and a replayed job of the step it is in', () => {
    expect(isStepDue('QUEUED', 'FINDING_VIDEO')).toBe(true);
    expect(isStepDue('FINDING_VIDEO', 'FINDING_VIDEO')).toBe(true);
  });

  it('skips a step the Processing is already past', () => {
    expect(isStepDue('DOWNLOADING_AUDIO', 'FINDING_VIDEO')).toBe(false);
    expect(isStepDue('COMPLETED', 'FINDING_VIDEO')).toBe(false);
  });

  it('never runs a step of a failed Processing', () => {
    expect(isStepDue('FAILED', 'FINDING_VIDEO')).toBe(false);
  });
});
