/** Loaded only for a guide melody or a calibration started by the User. */
export async function createSingingSynth() {
  const Tone = await import('tone');
  await Tone.start();
  const synth = new Tone.Synth({
    volume: -14,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.008, decay: 0.03, sustain: 0.6, release: 0.04 },
  }).toDestination();
  return {
    play(midi: number, seconds: number) {
      synth.triggerAttackRelease(
        440 * 2 ** ((midi - 69) / 12),
        Math.max(0.01, seconds),
        Tone.immediate(),
      );
    },
    stop() {
      synth.triggerRelease(Tone.immediate());
    },
    dispose() {
      synth.dispose();
    },
  };
}

/** Resume the shared audio context during a playback gesture after a reload. */
export async function resumeSingingAudio(): Promise<void> {
  const Tone = await import('tone');
  await Tone.start();
}
