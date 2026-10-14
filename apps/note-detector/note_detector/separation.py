"""Vocal separation with the Mel-Band RoFormer "Kim" vocals model.

Adapter between the files on disk and the model: it loads the weights once
per worker process, cuts the music into overlapping chunks
(`separation_plan`), runs the model on each in fp32 and blends the outputs.
Needs the model stack (torch, soundfile, ...), so it is omitted from coverage
and checked against `audio-separator` by the parity test.
"""

import logging
import os
from dataclasses import dataclass, fields
from functools import lru_cache
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import yaml

from note_detector.mel_band_roformer import (
    AUDIO_CHANNELS,
    MelBandRoformer,
    MelBandRoformerConfig,
)
from note_detector.separation_plan import OverlapAdd, plan_chunks

logger = logging.getLogger(__name__)

# Downloaded and checksum-verified by the Dockerfile.
MODELS_DIR = Path(os.environ.get("NOTE_DETECTOR_WEIGHTS_DIR", "/app/weights"))
WEIGHTS_PATH = MODELS_DIR / "mel-band-roformer" / "MelBandRoformer.ckpt"
CONFIG_PATH = MODELS_DIR / "mel-band-roformer" / "config.yaml"

# Each sample is seen by four chunks. fp32 throughout: the GPU has room, so
# quality is never traded for speed.
OVERLAP = 4
# Chunks per forward pass (the published config's inference batch size).
BATCH_SIZE = 4


class _ConfigLoader(yaml.SafeLoader):
    """The published config tags a list as a Python tuple."""


_ConfigLoader.add_constructor(
    "tag:yaml.org,2002:python/tuple",
    lambda loader, node: tuple(loader.construct_sequence(node)),
)


@dataclass(frozen=True)
class Separator:
    model: MelBandRoformer
    chunk_size: int
    sample_rate: int
    device: torch.device

    def separate(self, audio: np.ndarray) -> np.ndarray:
        """`(2, samples)` float32 music in, the vocals out, same shape."""
        total = audio.shape[1]
        plan = plan_chunks(total, self.chunk_size, OVERLAP)
        padded = np.pad(audio, ((0, 0), (0, plan.padded_length - total)))
        blender = OverlapAdd(plan, channels=audio.shape[0])
        for first in range(0, len(plan.starts), BATCH_SIZE):
            starts = plan.starts[first : first + BATCH_SIZE]
            batch = np.stack(
                [padded[:, s : s + self.chunk_size] for s in starts]
            )
            for start, vocals in zip(starts, self._run(batch), strict=True):
                blender.add(start, vocals)
        return blender.result(total)

    def _run(self, batch: np.ndarray) -> np.ndarray:
        with torch.inference_mode():
            tensor = torch.from_numpy(batch).to(self.device)
            return self.model(tensor).float().cpu().numpy()


def load_separator(
    weights: Path = WEIGHTS_PATH,
    config: Path = CONFIG_PATH,
    device: str | None = None,
) -> Separator:
    published = yaml.load(config.read_text(), Loader=_ConfigLoader)  # noqa: S506
    audio, model_section = published["audio"], published["model"]
    if audio["num_channels"] != AUDIO_CHANNELS:
        raise ValueError("the vocals model is stereo")

    names = {field.name for field in fields(MelBandRoformerConfig)}
    model = MelBandRoformer(
        MelBandRoformerConfig(
            **{k: v for k, v in model_section.items() if k in names}
        )
    )
    state = torch.load(weights, map_location="cpu", weights_only=True)
    model.load_state_dict(state, strict=True)

    target = torch.device(
        device or ("cuda" if torch.cuda.is_available() else "cpu")
    )
    model.to(target).eval()
    logger.info("vocal separation model loaded on %s", target)
    return Separator(
        model=model,
        chunk_size=audio["chunk_size"],
        sample_rate=audio["sample_rate"],
        device=target,
    )


def read_stereo(path: Path, sample_rate: int) -> np.ndarray:
    """Reads a WAV as `(2, samples)` float32; mono is duplicated."""
    data, rate = sf.read(path, dtype="float32", always_2d=True)
    if rate != sample_rate:
        raise ValueError(f"expected {sample_rate} Hz audio, got {rate} Hz")
    if data.shape[1] == 1:
        data = np.repeat(data, AUDIO_CHANNELS, axis=1)
    return np.ascontiguousarray(data[:, :AUDIO_CHANNELS].T)


def write_stereo(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    sf.write(path, audio.T, sample_rate, subtype="PCM_16")


@lru_cache(maxsize=1)
def shared_separator() -> Separator:
    return load_separator()


def extract_vocals(music: Path, vocals: Path) -> None:
    """The handler's vocal separation step: music WAV in, vocals WAV out."""
    separator = shared_separator()
    audio = read_stereo(music, separator.sample_rate)
    write_stereo(vocals, separator.separate(audio), separator.sample_rate)
