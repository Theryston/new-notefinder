import { afterEach, expect, it, vi } from 'vitest';
import { calibratedVoice } from './calibrated-voice';
import { singingAidsStore } from './stores/singing-aids-store';
import { voiceTrail } from './voice-trail';

afterEach(() => {
  voiceTrail.clear();
  singingAidsStore.setState({ offset: 0 });
});
it('shifts only presentation and redraws when the device adjustment changes', () => {
  let rate = 1;
  const voice = calibratedVoice(() => rate);
  const redraw = vi.fn();
  const stop = voice.subscribe(redraw);
  voiceTrail.push(5, 69.25);
  singingAidsStore.setState({ offset: 0.2 });
  expect(voice.segments(4.7, 4.9)).toEqual([[{ time: 4.8, midi: 69.25 }]]);
  expect(voiceTrail.segments(4.9, 5.1)).toEqual([[{ time: 5, midi: 69.25 }]]);
  expect(voiceTrail.latest()).toBe(69.25);
  rate = 0.5;
  expect(voice.segments(4.8, 5)).toEqual([[{ time: 4.9, midi: 69.25 }]]);
  expect(redraw).toHaveBeenCalledTimes(2);
  stop();
  voiceTrail.push(5.1, 70);
  expect(redraw).toHaveBeenCalledTimes(2);
});
