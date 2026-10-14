# 8. The browser pitch engine starts with a classic detector

- Status: accepted
- Date: 2026-10-14

## Context

With the mic on, the practice page finds the note the user sings in real time
(spec #160, ticket #169). The spec asks for a pitch ML model of about 5 MB or
less (CREPE or SPICE class) as the primary engine and a classic YIN/MPM
detector as the fallback, for devices that cannot load or keep up with the
model.

The ticket was built where no model with a redistributable license could be
fetched, and the maintainer decided not to invent one.

## Decision

- The engine is a pipeline of small, pure steps in `apps/web/features/practice`:
  an AudioWorklet captures the mic (echo cancellation and noise suppression
  on, auto gain off); a YIN detector reads a 2048-sample window every 512
  samples; a smoother gates by confidence, pulls one-reading octave slips
  back to the singer's octave and takes a median of five readings.
- **Only the classic detector ships for now.** The mic session is a dynamic
  import, so listening costs no extra download. Which engine runs shows in the
  debug log only.
- A model joins as the primary engine without touching the rest: it has to
  produce the same readings (frequency and confidence) and fall back to YIN
  when it fails to load or cannot keep up.
- The voice line is placed on the Track's time minus the browser-reported
  output, base and input latency, plus half the detector window
  (`latencyCompensation`). A per-device calibration offset comes with the
  calibration ticket.

## Consequences

- Accuracy depends on YIN and the smoothing alone until a model is added. The
  maintainer judges accuracy by singing (no benchmark, per the spec); the unit
  tests only check correctness on synthetic tones and harmonics.
- The AudioWorklet module is a plain `.js` file next to the detector, loaded by
  `new URL(..., import.meta.url)`, because an AudioWorklet loads a file by URL
  and cannot run bundled TypeScript.
