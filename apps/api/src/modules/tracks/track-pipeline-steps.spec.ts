import {
  firstPipelineStep,
  isStepDue,
  nextPipelineStep,
} from './track-pipeline-steps.js';

describe('track pipeline steps', () => {
  it('starts with finding the video', () => {
    expect(firstPipelineStep()).toBe('FINDING_VIDEO');
  });

  it('has no step after the last one that exists', () => {
    expect(nextPipelineStep('FINDING_VIDEO')).toBeUndefined();
  });

  it('has no step after a step that is not in this build', () => {
    expect(nextPipelineStep('DOWNLOADING_AUDIO')).toBeUndefined();
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
