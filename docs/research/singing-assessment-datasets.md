# Singing performance assessment research

Researched on 2026-10-27. This is research, not an implementation specification.
Only primary papers, author repositories and dataset/model cards support the
findings below. No datasets or model weights were downloaded or executed.

## Singing Coach AI: what is publicly verifiable

The [Play listing](https://play.google.com/store/apps/details?id=com.singingcoach.ai)
identifies the product and links to its official website. Its
[workflow page](https://singingcoach.ai/how-it-works) describes recording or
uploading 30–60 seconds, receiving overall and per-dimension scores, and
getting focus areas and exercises. The [feature page](https://singingcoach.ai/features)
advertises 26 dimensions grouped into tone/timbre, range/power, technical
control, and expression/style. Examples include pitch, vibrato, breathiness,
agility and emotional delivery.

No scoring formula, training corpus, model architecture or independent
validation was found in the reviewed public product pages. These pages
establish advertised behavior, not verified accuracy or the internal method.
The app was not installed, run or reverse engineered. An independent product
should learn from the workflow and validate its own assessment approach.

## Dataset and model shortlist

The useful distinction is between **recognizing a vocal technique**,
**predicting how listeners rate a performance**, and **detecting recording or
synthetic-audio defects**. These targets are not interchangeable. Availability
of a repository also does not establish commercial permission for its audio,
annotations, weights and dependencies.

| Resource | Supervision and population | Best use for notefinder | Commercial position found |
| --- | --- | --- | --- |
| VocalSet | About 10 hours, 20 professional singers, 17 techniques, five vowels, exercises and excerpts | Train/test technique descriptors; controlled acoustic experiments | CC BY 4.0 provenance; attribute creators and verify chosen release |
| GTSinger | 80.59 hours, 20 skilled singers, nine languages; six phoneme-level technique labels | Research multilingual technique recognition and contextual labels | Dataset CC BY-NC-SA 4.0; additional permission needed for commercial use |
| Sing-MD / VocalVerse | Roughly 1,000 selected Chinese karaoke performances; breath, timbre, emotion and technique ratings plus expert critiques | Closest published example of the requested multidimensional assessment | Project code and weights CC BY-NC-ND 4.0; commercial permission required; audio has no independent permissive grant verified |
| SingEval / DAMP | 400 performances: four songs, 100 singers per song; crowd-rated singing quality | Study human performance ranking | Annotation repository explicitly research-only; audio obtained separately from DAMP |
| PESnQ | Small English singing set, expert ratings, reference-performance comparisons | Interpretable baseline and evaluation design | Code/models GPLv3, optional commercial licence; audio permission is separate and not established |
| SingMOS-Pro | 7,981 Chinese/Japanese clips, primarily generated singing; professional listening ratings | Research perceived naturalness of generated singing | Dataset card CC BY 4.0; code MIT; checkpoint and underlying-source rights require separate checks |
| Vibrato v2.2 | Small CNN trained on VocalSet; technique labels and algorithm-derived acoustic targets | Experimental lightweight descriptor baseline | Developer declares Apache-2.0 code/weights and CC BY 4.0 training audio; no human quality-score validation |
| VocalCoachBench | 515 recordings, 18 vocal trainers, 1,056 submissions and 12,051 coaching claims | Evaluate whether coaching identifies the right issues and advice | Mixed audio-source restrictions; several sources explicitly noncommercial or research-only |
| PitchIn / PeerCoach | 14,445 instruction examples from 7,042 community recordings | Research specialized audio-language coaching | Paper plans text/source-link release; does not relicense recordings/posts; no commercial clearance verified |

## VocalSet and derived annotations

The authors' [dataset release](https://zenodo.org/records/1442513) describes
10.1 hours of unaccompanied professional singing in scales, arpeggios, sustained
notes and excerpts. This is technique supervision, not labels saying whether
an amateur sang well. The [author paper](https://interactiveaudiolab.github.io/assets/papers/wilkins_seetharaman_ismir18.pdf)
describes 17 techniques. The [Vibrato provenance table](https://huggingface.co/Vibrato-ai/vibrato-v2#provenance)
identifies its VocalSet training audio and human technique/vowel annotations
as CC BY 4.0. The paper itself is also CC BY 4.0; confirm release metadata
before importing audio rather than relying only on the paper's copyright.

[Annotated-VocalSet](https://zenodo.org/records/7061507) adds pitch contours,
note boundaries, transitions, durations and lyrics. Its separate annotation
licence must be verified before reuse; the browser text did not expose it.
The [corrected derivative](https://zenodo.org/records/10200775) reports manual
fixes to missing files and notes. Audio and annotation distributions can differ
in size and contents; do not assume that every reported corpus duration maps
to one archive. No Portuguese amateur-performance coverage was established.

## GTSinger

The [NeurIPS paper](https://papers.nips.cc/paper_files/paper/2024/file/023d2c1a17cf35b11a0cbb43a0677c91-Paper-Datasets_and_Benchmarks_Track.pdf)
reports 80.59 hours of singing by 20 singers across nine languages, plus
16.16 hours of paired speech. Mixed voice, falsetto, breathy, pharyngeal,
vibrato and glissando receive phoneme-level annotations, with technique/control
renditions. These identify technique occurrence, not technique appropriateness
or singing quality. Its explicit [dataset licence](https://github.com/AaronZ345/GTSinger/blob/main/dataset_license.md)
is CC BY-NC-SA 4.0. Free download does not permit commercial training or
deployment. No separate commercial grant for code or weights was verified.

## Sing-MD / VocalVerse: closest match to the product idea

The [ACM MM 2025 paper](https://arxiv.org/html/2512.06999v1) uses Chinese KTV
performances with scores and critiques across breath control, timbre quality,
emotional expression and vocal technique. The experimental professional subset
contains 1,000 recordings; the paper says those experiment labels come from
one expert, while a second expert rated a shared 30-performance subset.
Exact agreement between those experts was below 45% in every dimension.
The domain is Chinese singing and the selected performances are relatively
proficient, limiting conclusions about Brazilian beginners.

The [current repository](https://github.com/CarlWangChina/QwenFeat-Vocal-Score)
publishes expert spreadsheets, scoring rubrics and model implementations.
Its [model card](https://huggingface.co/karl-wang/QwenFeat-Vocal-Score)
describes selecting roughly 1,000 performances from a screened 10,000-recording
set originally sourced from over 100,000 recordings. It links
[audio separately](https://huggingface.co/datasets/karl-wang/VocalVerse-dataset).
That audio repository had no dataset card when checked, so its independent
licence and exact correspondence to the professional subset remain unverified.

The [project licence](https://raw.githubusercontent.com/CarlWangChina/QwenFeat-Vocal-Score/master/LICENSE)
explicitly covers code/model weights under CC BY-NC-ND 4.0 and prohibits
integration into commercial software, for-profit karaoke and AI services
without separate permission. Public weights are available for QwenAudio and
MuQ scoring variants, but the repository says its speaker-decoupling variant
weights were lost. Published experimental results should not be attributed
automatically to every downloadable checkpoint.

**Inference:** use this as evidence that multidimensional performance models
are feasible and as a candidate for licensing discussions, not as a model
ready for unrestricted use in a paid product.

## Human performance baselines: SingEval and PESnQ

[SingEval](https://github.com/chitralekha18/SingEval) provides human ratings
for 400 DAMP renditions: four songs each sung by 100 singers. It distributes
annotations without audio and explicitly prohibits commercial use.
This is real human-performance supervision, but small and narrow in repertoire.

[PESnQ's author repository](https://github.com/chitralekha18/PESnQ_APSIPA2017)
contains audio, expert ground truth and feature extraction. Its code expects
unaccompanied 16 kHz reference/test singing of the same song and recommends
short clips. The [journal paper](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/5F6AECB907FE842481D070850EDF1EFA/S2048770318000100a.pdf/technical_framework_for_automatic_perceptual_evaluation_of_singing_quality.pdf)
uses 20 singers across two English songs and ratings by five professional
musicians for pitch, rhythm, vibrato, timbre, articulation, volume and range.
The repository states GPLv3 for code/models and offers separate commercial
licensing; GPL is not itself a noncommercial licence. Audio reuse permission
was not established by that code/model statement.

## SingMOS-Pro: useful research with a different target

The [paper](https://arxiv.org/abs/2510.01812) describes 7,981 clips generated
by 41 systems across 12 datasets and professional quality annotations.
The [dataset card](https://huggingface.co/datasets/TangRain/SingMOS-Pro)
declares CC BY 4.0 and Chinese/Japanese audio, with 11.15 hours in total.
The [predictor repository](https://github.com/South-Twilight/SingMOS) is MIT
and provides pretrained MOS predictors using wav2vec2 backbones. Its example
explicitly predicts naturalness. Code MIT does not independently settle
checkpoint/backbone licences or the rights of every source recording.

**Inference:** generated-audio naturalness MOS is not a validated measure of
whether a human sings well. Treat this model as a research comparator, not a
drop-in teacher score or a detector of physical vocal tension.

## Vibrato v2.2: permissive but not a perceptual-quality model

The [model card](https://huggingface.co/Vibrato-ai/vibrato-v2) reports an
Apache-2.0, 269,464-parameter CNN trained from scratch on VocalSet, with
PyTorch/CoreML weights and a training pipeline. Its test singers are held
out; technique macro-F1 is 0.463. Its authors caution that vibrato detection
is ineffective, stability prediction is weak, and several named outputs
have no positive training examples. This is a single professional-singer
corpus, not validated amateur singing in varied consumer environments.

The [evaluation report](https://huggingface.co/Vibrato-ai/vibrato-v2/blob/main/V2_EVAL.md)
explains that quality labels come from acoustic measurements, not teachers:
brightness from spectral centroid, power from RMS, breathiness from inverted
CPPS, strain from jitter/shimmer, and stability from pitch dispersion.
Learning to reproduce these labels does not validate the labels as singing
quality or muscular-tension measurements. In particular, RMS can reflect
microphone gain and distance. A prototype should compare direct measurement
against learned approximation before adding a model.

## Coaching evaluation and newest research

[VocalCoachBench](https://arxiv.org/html/2609.04241v1) is a useful benchmark
for whether model feedback matches expert issues. Its Appendix D lists
audio licences per source: DAMP is research/education-only, while PopBuTFy,
GTSinger and several other corpora are noncommercial; other subsets use
CC BY or CC BY-SA. Public benchmark annotations do not override those terms.
Neither its mixed corpus nor the paper's licence establishes an unrestricted
commercial training dataset.

[PitchIn](https://arxiv.org/html/2610.17036v1), submitted in October 2026,
reports task-specific audio-language adaptation using PeerCoach community
supervision. The paper's ethics section plans release of reconstructed
coaching text and source audio links only, leaves source rights with their
holders and says no substantive Reddit response was received. Code/weights
with a verified usable licence were not established in this research.
Promising results do not supply permission to train a commercial product on
the underlying community recordings.

## Optional phonation research

[voice2mode](https://arxiv.org/html/2602.13928v1) studies 763 sustained vowels
in breathy/modal/flow/pressed modes. The [repository](https://github.com/ajuanijustus/voice2mode)
states the corpus is from **one professional soprano**. Its cross-validation
accuracy therefore does not establish generalization to new singers.
The [original author's report](https://research.gold.ac.uk/id/eprint/9621/1/phonation-r11.pdf)
explicitly specifies CC BY-NC-SA for the source corpus. The repository claims
MIT code, but its linked LICENSE returned 404 when checked. This is a
research direction, not a cleared pretrained tension detector.

## Perceived strain: direct evidence and limits

The September 2026 [singing-strain study](https://pubs.asha.org/doi/10.1044/2026_JSLHR-25-01016)
used 16 train/validation singers and 11 independent test singers. Audio-only
test Spearman correlation with expert ratings was 0.812, not 81.2% accuracy.
The task used controlled syllable recordings, not arbitrary phone-recorded
songs. Data are private, with possible noncommercial research access only.
This supports researching perceived effort, not claiming direct measurement
of muscle tension or injury from a consumer microphone.

The [National Center for Voice and Speech](https://ncvs.org/tutorials/fluctuations-and-perturbations-of-the-voice/)
distinguishes perturbations from fluctuations and notes the artistic role of
vibrato. The [Praat manual](https://www.fon.hum.uva.nl/praat/manual/Voice.html)
also documents dependence on pitch-analysis settings. Jitter, shimmer or
spectral brightness must not become universal quality or health penalties.

## Method and product proposal

This section is a design inference from the evidence, not an evaluated system.

- Capture the microphone waveform with playback timestamps, transposition,
  speed and capture settings. Prefer headphones for evaluable recordings.
  Gate clipping, insufficient voice, background leakage and unreliable
  reference segments before rating the performance; report uncertainty
  separately rather than penalizing the singer for recording conditions.
- Measure continuous pitch-center errors in cents, drift and sustain control.
  Separate expressive transitions and vibrato from unintended instability.
  Estimate note/phrase onset timing with hardware-latency calibration and
  constrained alignment. Unlimited time warping can hide timing mistakes.
- Extract spectral/cepstral descriptors or pretrained audio embeddings to
  research timbral control and perceived phonation. Condition evaluation on
  pitch, vowel, style and recording conditions. Timbre identity is not a
  universal better/worse scale, and singer similarity is a different task.
- Fit a small supervised multiattribute model to independent teacher rubrics
  and pairwise comparisons before considering a large end-to-end model.
  Learn or calibrate the overall score against that rubric; arbitrary weights
  do not establish perceived singing quality. Score the current performance,
  not the person's fixed talent. Show unavailable attributes as unassessed.
- Use a language model to explain grounded findings and propose practice,
  with timestamps and evidence. Do not let fluent commentary be the only
  evidence for the numeric score. Strain and expression need their own
  validation before contributing to a commercial overall score.

[VocalCoachBench](https://arxiv.org/abs/2609.04241) finds limitations in
fine-grained expert issue matching among audio-language models.
[PitchIn's full paper](https://arxiv.org/html/2610.17036v1) shows that
instruction tuning improves useful coaching, while its principal model's
controlled-defect matching remains approximately chance (49.4%). Better
feedback prose therefore does not establish reliable sensitivity to defects.

For a pilot, commission a few hundred diverse, consented clips with multiple
independent teachers and anchored rubrics. This is a proposed feasibility
experiment, not a claim that this sample size guarantees training sufficiency.
Hold out singers, songs and capture conditions. Compare against simple DSP,
human disagreement, repeated recordings and controlled changes. Expand the
corpus when learning curves and subgroup failures justify doing so. Keep
training consent separate from consent to analyze a recording.

## Fit with the existing repository

Read-only inspection on the research date found:

- `apps/web/features/practice/scoring.ts` computes per-note hit/near/miss
  votes and accuracy. It is not a perceptual singing-quality model.
- `apps/web/features/practice/scored-attempt.ts` submits aggregate accuracy,
  coverage, settings and run metadata; this payload contains neither the
  microphone waveform nor timbre features.
- `apps/web/features/practice/pitch/pitch-engine.ts` uses CREPE tiny with YIN
  fallback for live pitch. Its smoothed pitch output is insufficient for
  timbre analysis or cycle-level perturbation analysis.
- `apps/web/features/practice/pitch/capture-worklet.js` already receives
  microphone blocks. Optional recording/feature retention and analysis would
  be new behavior, not an existing saved-recording capability.
- `apps/note-detector/CLAUDE.md` documents GAME Vocal notes, RMVPE Pitch curves
  and separated reference vocals. These provide reference context; errors and
  studio effects must not be treated as unquestionable singing ground truth.

For tooling, [librosa's licence](https://github.com/librosa/librosa/blob/main/LICENSE.md)
is ISC. [openSMILE's licence](https://github.com/audeering/opensmile-python/blob/main/LICENSE)
requires additional permission for product use, including models/features
derived with it. Research code, data and pretrained checkpoints must each
receive an independent licence check before product integration.

Suggested first slice: opt-in analysis of a selected passage, continuous
intonation/timing/sustain feedback, recording confidence, timestamped reasons
and comparison between attempts. Develop teacher-calibrated timbral quality,
expression and perceived-effort assessment as validated additions. Keep free
singing and live basic feedback available; no billing or runtime changes are
part of this research.

## Recommendation from the dataset evidence

1. Build interpretable pitch/timing/control measurements and validate them
   against human judgment before assigning a broad singing-quality meaning.
2. Use VocalSet for controlled technique experiments and consider Vibrato as
   a lightweight comparison, with weak outputs suppressed.
3. For perceptual quality, either negotiate a suitable licence or commission
   consented, representative recordings and independent teacher ratings.
   Include Brazilian Portuguese, English, different genres, beginner through
   advanced singers, devices and rooms. Record separate dimension ratings,
   comments and pairwise judgments, including uncertainty.
4. Split evaluation by singer and song, not random excerpts of the same
   recording. Hold out devices/recording conditions and compare results with
   teacher agreement and simple algorithmic baselines.
5. Keep an overall score traceable to validated dimensions. Do not reward
   similarity to a famous singer's identity or classify a naturally breathy
   timbre as universally bad. Assess style and intentional technique in context.

These recommendations are proposed product/research choices. No reviewed
resource establishes a universal objective score for good singing, a reliable
consumer-microphone measurement of muscular tension, or validated performance
across the full notefinder audience without additional evaluation.
