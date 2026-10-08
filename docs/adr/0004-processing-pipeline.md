# 4. Processing pipeline: BullMQ in the API, RunPod by polling, RapidAPI for audio

- Status: accepted
- Date: 2026-10-08

## Context

A Track's Processing turns its Recording into vocal notes and Timed lyrics. The
legacy app ran it as a Trigger.dev task: YouTube Music metadata, audio
downloaded through a RapidAPI service, vocals separated and notes detected by
`nfp-audio` (a Python RunPod serverless worker that lived in its own repo,
now `apps/nfp-audio` in this monorepo; it answered through a Trigger.dev
wait-token callback, with an AWS SQS path behind a runtime toggle), and
Whisper for the words. The new app takes the Recording
from the Music catalog instead of YouTube Music (ADR 0002), so the YouTube
video has to be found for it, and there is no Trigger.dev.

## Decision

- **Processing is a BullMQ job in the API process**, with resumable steps:
  finding the video, downloading the audio, extracting the vocals, detecting
  the notes and extracting the Timed lyrics. Artists, Albums and covers are
  imported by a separate job in parallel, which never fails the Processing.
- **The video is reconciled, not trusted.** Candidates are the Recording's
  YouTube links from MusicBrainz plus a YouTube Music song search
  (`youtubei.js`), each checked against the Recording's duration, title and
  artists. The chosen video is also the one the timeline plays, so the notes
  stay in sync with it. The Bright Data proxy is used for YouTube Music
  requests only when its env vars are set.
- **Audio is downloaded through the RapidAPI service the legacy used**, not
  self-hosted `yt-dlp`. From a datacenter IP, YouTube answers "Sign in to
  confirm you're not a bot" unless a residential proxy, a PO token provider and
  a JS runtime are kept up to date, and the setup breaks whenever YouTube
  changes. The RapidAPI service handles that on its side.
- **`nfp-audio` moves into the monorepo as `apps/nfp-audio`** (Python, still a
  RunPod serverless image published to GHCR; the model weights are a regular
  git blob, not Git LFS, by maintainer decision). It no longer calls the API: it reads the audio from a URL, uploads the vocals
  through a presigned URL, reports its two stages with RunPod progress updates
  and returns the notes as the job output. The API starts it with `/run` and
  **polls `/status`** with delayed BullMQ jobs, so there is no inbound
  endpoint and no lost callback. The AWS SQS path and the runtime toggle are
  dropped.

## Considered options

- **`yt-dlp` with the proxy**: no third party, but not reliable from a VPS
  (see above).
- **RunPod webhook** to an internal endpoint: push instead of polling, but it
  needs a public endpoint and a fallback when a webhook is lost.
- **Keeping `nfp-audio` in its own repo**: its contract changes with this
  pipeline, so the two would have to be released together anyway.

## Consequences

- The API image needs `ffmpeg` (the audio is converted as the legacy did).
- Downloading depends on the RapidAPI service staying up and affordable.
- `/v1/internal/*` and SQS are no longer part of the plan for note detection.
