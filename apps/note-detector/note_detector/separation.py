"""Vocal separation with the Mel-Band RoFormer "Kim" vocals model.

The adapter between the files on disk and the model: only the calls into
torch, soundfile and yaml live here (omitted from coverage). Everything it
decides is in the pure modules: the config (`separation_config`), the chunk
plan and batches (`separation_plan`) and the audio in and out
(`separation_audio`). Checked against `audio-separator` by the parity test.
"""

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import yaml

from note_detector.separation_audio import clip_for_pcm, stereo_from_samples
from note_detector.separation_config import (
    CONFIG_FILE,
    WEIGHTS_FILE,
    SeparationConfig,
    parse_separation_config,
)
from note_detector.separation_plan import (
    OverlapAdd,
    chunk_batches,
    plan_chunks,
)
from note_detector.vendor.mel_band_roformer.model import MelBandRoformer

logger = logging.getLogger(__name__)

# Each sample is seen by four chunks. fp32 throughout: the GPU has room, so
# quality is never traded for speed.
OVERLAP = 4


class _ConfigLoader(yaml.SafeLoader):
    """The published config tags a list as a Python tuple."""


_ConfigLoader.add_constructor(
    "tag:yaml.org,2002:python/tuple",
    lambda loader, node: tuple(loader.construct_sequence(node)),
)


@dataclass(frozen=True)
class Separator:
    model: MelBandRoformer
    config: SeparationConfig
    device: torch.device

    def separate(self, audio: np.ndarray) -> np.ndarray:
        """`(2, samples)` float32 music in, the vocals out, same shape."""
        total = audio.shape[1]
        plan = plan_chunks(total, self.config.chunk_size, OVERLAP)
        blender = OverlapAdd(plan, channels=audio.shape[0])
        for starts, batch in chunk_batches(audio, plan, self.config.batch_size):
            for start, vocals in zip(starts, self._run(batch), strict=True):
                blender.add(start, vocals)
        return blender.result(total)

    def _run(self, batch: np.ndarray) -> np.ndarray:
        with torch.inference_mode():
            tensor = torch.from_numpy(batch).to(self.device)
            return self.model(tensor).float().cpu().numpy()


def load_separator(directory: Path, device: str | None = None) -> Separator:
    published = yaml.load(
        (directory / CONFIG_FILE).read_text(), Loader=_ConfigLoader
    )
    config = parse_separation_config(published)

    model = MelBandRoformer(config.model)
    state = torch.load(
        directory / WEIGHTS_FILE, map_location="cpu", weights_only=True
    )
    model.load_state_dict(state, strict=True)

    if device is None and not torch.cuda.is_available():
        logger.warning("no CUDA device: vocal separation runs on the CPU")
    target = torch.device(
        device or ("cuda" if torch.cuda.is_available() else "cpu")
    )
    model.to(target).eval()
    logger.info("vocal separation model loaded on %s", target)
    return Separator(model=model, config=config, device=target)


def extract_vocals(separator: Separator, music: Path, vocals: Path) -> None:
    """The handler's vocal separation step: music WAV in, vocals WAV out."""
    rate = separator.config.sample_rate
    samples, file_rate = sf.read(music, dtype="float32", always_2d=True)
    audio = stereo_from_samples(samples, file_rate, rate)
    separated = clip_for_pcm(separator.separate(audio))
    sf.write(vocals, separated.T, rate, subtype="PCM_16")
