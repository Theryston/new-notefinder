"""Cuts the vocals at silences, as GAME's own slicer does before inference.

A port of `inference/slicer2.py` of openvpi/GAME (MIT) with the parameters its
`infer.py extract` uses (-40 dB, 1 s minimum clip, 200 ms minimum silence,
100 ms of silence kept). The model sees one clip at a time, so a long silence
never reaches it, and each clip's times are offset by where it starts.
"""

from dataclasses import dataclass

import numpy as np

THRESHOLD_DB = -40.0
MIN_LENGTH_MS = 1000
MIN_INTERVAL_MS = 200
HOP_MS = 20
MAX_SILENCE_KEPT_MS = 100


@dataclass(frozen=True)
class Clip:
    # Seconds from the start of the vocals.
    offset: float
    waveform: np.ndarray


@dataclass(frozen=True)
class _Params:
    threshold: float
    hop: int
    window: int
    min_length: int
    min_interval: int
    max_sil_kept: int


def _params(sample_rate: int) -> _Params:
    min_interval_samples = sample_rate * MIN_INTERVAL_MS / 1000
    hop = round(sample_rate * HOP_MS / 1000)
    return _Params(
        threshold=10 ** (THRESHOLD_DB / 20.0),
        hop=hop,
        window=min(round(min_interval_samples), 4 * hop),
        min_length=round(sample_rate * MIN_LENGTH_MS / 1000 / hop),
        min_interval=round(min_interval_samples / hop),
        max_sil_kept=round(sample_rate * MAX_SILENCE_KEPT_MS / 1000 / hop),
    )


def _rms(samples: np.ndarray, frame_length: int, hop: int) -> np.ndarray:
    padded = np.pad(samples, (frame_length // 2, frame_length // 2))
    frames = np.lib.stride_tricks.sliding_window_view(padded, frame_length)
    return np.sqrt(np.mean(np.abs(frames[::hop]) ** 2, axis=-1))


def _argmin(rms: np.ndarray, start: int, stop: int) -> int:
    """Index of the quietest frame in rms[start..stop], inclusive."""
    return int(rms[start : stop + 1].argmin()) + start


def _silence_cut(
    rms: np.ndarray, start: int, end: int, params: _Params
) -> tuple[int, int]:
    """The frames to cut out of the silence that spans frames [start, end].

    GAME also handles a silence no longer than the kept silence, which cannot
    happen with these parameters: a leading silence is cut only past the kept
    length, and any other only from the minimum interval (twice as long).
    """
    kept = params.max_sil_kept
    left = _argmin(rms, start, start + kept)
    right = _argmin(rms, end - kept, end)
    if end - start <= kept * 2:
        middle = _argmin(rms, end - kept, start + kept)
        if start == 0:
            return (0, right)
        return (min(left, middle), max(right, middle))
    return (0, right) if start == 0 else (left, right)


def _find_cuts(rms: np.ndarray, params: _Params) -> list[tuple[int, int]]:
    cuts: list[tuple[int, int]] = []
    silence_start: int | None = None
    clip_start = 0
    for i, level in enumerate(rms):
        if level < params.threshold:
            if silence_start is None:
                silence_start = i
            continue
        if silence_start is None:
            continue
        leading = silence_start == 0 and i > params.max_sil_kept
        middle = (
            i - silence_start >= params.min_interval
            and i - clip_start >= params.min_length
        )
        if leading or middle:
            cut = _silence_cut(rms, silence_start, i, params)
            cuts.append(cut)
            clip_start = cut[1]
        silence_start = None
    total = rms.shape[0]
    if (
        silence_start is not None
        and total - silence_start >= params.min_interval
    ):
        stop = min(total, silence_start + params.max_sil_kept)
        cuts.append((_argmin(rms, silence_start, stop), total + 1))
    return cuts


def slice_vocals(waveform: np.ndarray, sample_rate: int) -> list[Clip]:
    """Cuts a mono waveform at its silences.

    A waveform of digital zeros gives no clip. Noise below -40 dB counts as
    silence too, but the cut keeps the quietest frame of each silence, so such
    a waveform can leave a clip of up to 100 ms, as in GAME.
    """
    params = _params(sample_rate)
    if -(-waveform.shape[0] // params.hop) <= params.min_length:
        return [Clip(0.0, waveform)]
    rms = _rms(waveform, params.window, params.hop)
    cuts = _find_cuts(rms, params)
    if not cuts:
        return [Clip(0.0, waveform)]
    edges = [(0, cuts[0][0])]
    edges += [(a[1], b[0]) for a, b in zip(cuts, cuts[1:], strict=False)]
    edges.append((cuts[-1][1], rms.shape[0]))
    return [
        Clip(
            begin * params.hop / sample_rate,
            waveform[begin * params.hop : end * params.hop],
        )
        for begin, end in edges
        if end > begin
    ]
