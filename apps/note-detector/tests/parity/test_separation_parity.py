"""Parity: our Mel-Band RoFormer separation matches `audio-separator`'s.

Runs only where the weights (and the reference separator) are present, never
in normal CI; there it is skipped. To run it:

    uv sync --group model --group parity-separation
    NOTE_DETECTOR_SEPARATION_DIR=<dir with the checkpoint and config> \
      uv run pytest -m parity tests/parity

The input is a short synthetic fixture (a vibrato voice-like tone over a
rhythmic noise bed), or any stereo 44.1 kHz WAV named by
`NOTE_DETECTOR_PARITY_FIXTURE`.
"""

import os
from pathlib import Path

import numpy as np
import pytest

pytestmark = pytest.mark.parity

SAMPLE_RATE = 44100
# Both implementations run the same weights in fp32 with overlap 4; they
# differ only in chunk windowing, so their outputs agree far above this.
MIN_SDR_DB = 25.0
REFERENCE_MODEL = "vocals_mel_band_roformer.ckpt"


def synthetic_fixture(seconds: int = 12) -> np.ndarray:
    t = np.arange(seconds * SAMPLE_RATE) / SAMPLE_RATE
    vibrato = 220 + 3 * np.sin(2 * np.pi * 5 * t)
    voice = 0.3 * np.sin(2 * np.pi * vibrato * t)
    voice += 0.15 * np.sin(2 * np.pi * 2 * vibrato * t)
    rng = np.random.default_rng(0)
    bed = (
        0.05 * np.sign(np.sin(2 * np.pi * 2 * t)) * rng.standard_normal(t.size)
    )
    left, right = voice + bed, voice + 0.8 * bed
    return np.stack([left, right]).astype(np.float32)


def sdr_db(reference: np.ndarray, estimate: np.ndarray) -> float:
    noise = np.sum((reference - estimate) ** 2) + 1e-12
    return float(10 * np.log10(np.sum(reference**2) / noise + 1e-12))


def test_our_separation_matches_audio_separator(tmp_path: Path):
    soundfile = pytest.importorskip("soundfile")
    pytest.importorskip("torch")
    audio_separator = pytest.importorskip("audio_separator.separator")

    from note_detector.separation import load_separator
    from note_detector.separation_config import (
        CONFIG_FILE,
        WEIGHTS_FILE,
        separation_directory,
    )

    directory = separation_directory(os.environ)
    if not (
        (directory / WEIGHTS_FILE).exists()
        and (directory / CONFIG_FILE).exists()
    ):
        pytest.skip("the Mel-Band RoFormer weights are not present")

    fixture = os.environ.get("NOTE_DETECTOR_PARITY_FIXTURE")
    if fixture:
        data, rate = soundfile.read(fixture, dtype="float32", always_2d=True)
        assert rate == SAMPLE_RATE
        music = np.ascontiguousarray(data.T)
    else:
        music = synthetic_fixture()
    music_path = tmp_path / "music.wav"
    soundfile.write(music_path, music.T, SAMPLE_RATE, subtype="FLOAT")

    ours = load_separator(directory).separate(music)

    reference_separator = audio_separator.Separator(
        output_dir=str(tmp_path),
        output_format="WAV",
        output_single_stem="Vocals",
        # audio-separator ignores the config's chunk_size and cuts chunks of
        # stft_hop_length * (segment_size - 1) samples; 801 gives 441 * 800 =
        # 352800, ours. It also scales input and output to a 0.9 peak by
        # default, which would show up as a gain difference.
        normalization_threshold=1.0,
        mdxc_params={
            "overlap": 4,
            "batch_size": 4,
            "segment_size": 801,
            "override_model_segment_size": True,
        },
    )
    reference_separator.load_model(REFERENCE_MODEL)
    (output_name,) = reference_separator.separate(str(music_path))
    reference, rate = soundfile.read(
        tmp_path / output_name, dtype="float32", always_2d=True
    )
    assert rate == SAMPLE_RATE

    length = min(ours.shape[1], reference.shape[0])
    assert sdr_db(reference.T[:, :length], ours[:, :length]) >= MIN_SDR_DB
