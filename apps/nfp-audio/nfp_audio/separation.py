"""Vocal separation: the legacy worker's CascadedNet, run over the mixture.

Ported from `extract_vocals.py` of the legacy worker. Only the path the worker
used is kept (one pass, no test-time augmentation, no post-processing), and
the upload to storage is gone: the handler uploads the file it gets back.
Needs the `model` dependency group and the weights in `models/`.
"""

import functools
import logging
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch

from nfp_audio.vocals_model import nets, spec_utils

logger = logging.getLogger(__name__)

MODEL_PATH = (
    Path(__file__).resolve().parent.parent / "models" / "voice_extract.pth"
)

# The parameters the legacy worker used, kept as they were.
SAMPLE_RATE = 44_100
N_FFT = 2048
HOP_LENGTH = 1024
CROP_SIZE = 256
BATCH_SIZE = 4
NOUT = 32
NOUT_LSTM = 128


def extract_vocals(music: Path, vocals: Path) -> None:
    device = _pick_device()
    model = _load_model(device)

    mixture, sample_rate = librosa.load(
        str(music),
        sr=SAMPLE_RATE,
        mono=False,
        dtype=np.float32,
        res_type="kaiser_fast",
    )
    if mixture.ndim == 1:
        mixture = np.asarray([mixture, mixture])

    mixture_spec = spec_utils.wave_to_spectrogram(mixture, HOP_LENGTH, N_FFT)
    vocal_spec = _vocal_spectrogram(model, device, mixture_spec)
    wave = spec_utils.spectrogram_to_wave(vocal_spec, hop_length=HOP_LENGTH)

    sf.write(str(vocals), wave.T, sample_rate)
    logger.info("separated vocals into %s", vocals)


def make_padding(width, cropsize, offset):
    left = offset
    roi_size = cropsize - offset * 2
    if roi_size == 0:
        roi_size = cropsize
    right = roi_size - (width % roi_size) + left

    return left, right, roi_size


def _pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda:0")
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        return torch.device("mps")
    return torch.device("cpu")


@functools.cache
def _load_model(device: torch.device) -> nets.CascadedNet:
    model = nets.CascadedNet(N_FFT, HOP_LENGTH, NOUT, NOUT_LSTM)
    state = torch.load(MODEL_PATH, map_location=device, weights_only=True)
    model.load_state_dict(state)
    model.to(device)
    return model


def _vocal_spectrogram(model, device, mixture_spec):
    """The vocal part of the mixture: everything the mask does not keep."""
    n_frame = mixture_spec.shape[2]
    offset = model.offset
    pad_l, pad_r, roi_size = make_padding(n_frame, CROP_SIZE, offset)
    padded = np.pad(
        mixture_spec, ((0, 0), (0, 0), (pad_l, pad_r)), mode="constant"
    )
    padded /= np.abs(mixture_spec).max()

    mask = _predict_mask(model, device, padded, roi_size)
    mask = mask[:, :, :n_frame]

    magnitude = np.abs(mixture_spec)
    phase = np.angle(mixture_spec)
    return (1 - mask) * magnitude * np.exp(1.0j * phase)


def _predict_mask(model, device, padded_spec, roi_size):
    offset = model.offset
    patches = (padded_spec.shape[2] - 2 * offset) // roi_size
    crops = np.asarray(
        [
            padded_spec[:, :, i * roi_size : i * roi_size + CROP_SIZE]
            for i in range(patches)
        ]
    )

    model.eval()
    masks = []
    with torch.no_grad():
        for start in range(0, patches, BATCH_SIZE):
            batch = torch.from_numpy(crops[start : start + BATCH_SIZE])
            batch_mask = model.predict_mask(torch.abs(batch.to(device)))
            batch_mask = batch_mask.detach().cpu().numpy()
            masks.append(np.concatenate(batch_mask, axis=2))

    return np.concatenate(masks, axis=2)
