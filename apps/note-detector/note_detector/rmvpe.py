"""The Pitch curve step: RMVPE on the separated vocals.

Glue between torch, the vendored network and the pure maths in
`rmvpe_math.py`; it needs the weights, so the unit tests omit it and a marked
check exercises it when the weights are present. The inference follows the RVC
project's (MIT): 16 kHz mono, a centered STFT with a 10 ms hop, the network
run in fp32, then the local-average decoding with RMVPE's own voicing.
"""

import math
from functools import cache
from pathlib import Path

import numpy as np
import soundfile
import torch
import torch.nn.functional as functional
from scipy.signal import resample_poly
from torch import nn

from note_detector import rmvpe_math as maths
from note_detector.vendor.rmvpe.deepunet import DeepUnet0
from note_detector.vendor.rmvpe.seq import BiGRU

DEFAULT_WEIGHTS_PATH = Path("/app/weights/rmvpe.pt")
# Frames run through the network at once (a multiple of 32), and the
# surroundings added on each side, so a long Track does not need the memory
# of the whole spectrogram.
CHUNK_FRAMES = 6400
CHUNK_CONTEXT_FRAMES = 320
N_CLASS = maths.N_BINS


class _Network(nn.Module):
    """The checkpoint's layout: `unet` (DeepUnet0, no timbre filter), `cnn`,
    `fc` (RVC's E2E)."""

    def __init__(self) -> None:
        super().__init__()
        self.unet = DeepUnet0((2, 2), 4, 5, 4, 1, 16)
        # DeepUnet0 builds a timbre filter its forward never calls, and the
        # checkpoint has no weights for it; dropping it keeps the load strict.
        del self.unet.tf
        self.cnn = nn.Conv2d(16, 3, (3, 3), padding=(1, 1))
        self.fc = nn.Sequential(
            BiGRU(3 * maths.N_MELS, 256, 1),
            nn.Linear(512, N_CLASS),
            nn.Dropout(0.25),
            nn.Sigmoid(),
        )

    def forward(self, mel: torch.Tensor) -> torch.Tensor:
        features = self.unet(mel.transpose(-1, -2).unsqueeze(1))
        return self.fc(self.cnn(features).transpose(1, 2).flatten(-2))


class _Rmvpe:
    def __init__(self, weights: Path, device: torch.device) -> None:
        self.device = device
        network = _Network()
        network.load_state_dict(torch.load(weights, map_location="cpu"))
        self.network = network.eval().to(device)
        filters = maths.mel_filterbank(
            maths.SAMPLE_RATE,
            maths.N_FFT,
            maths.N_MELS,
            (maths.MEL_FMIN, maths.MEL_FMAX),
        )
        self.mel_basis = torch.from_numpy(filters).float().to(device)
        self.window = torch.hann_window(maths.N_FFT).to(device)

    def mel(self, audio: np.ndarray) -> torch.Tensor:
        samples = torch.from_numpy(audio).float().to(self.device)
        spectrum = torch.stft(
            samples,
            n_fft=maths.N_FFT,
            hop_length=maths.HOP_LENGTH,
            win_length=maths.N_FFT,
            window=self.window,
            center=True,
            return_complex=True,
        )
        return torch.log(torch.clamp(self.mel_basis @ spectrum.abs(), 1e-5))

    @torch.inference_mode()
    def salience(self, mel: torch.Tensor) -> np.ndarray:
        n_frames = mel.shape[-1]
        parts = []
        for chunk in maths.plan_chunks(
            n_frames, CHUNK_FRAMES, CHUNK_CONTEXT_FRAMES
        ):
            window = mel[:, chunk.start : chunk.end]
            length = window.shape[-1]
            padded = functional.pad(
                window, (0, maths.padded_frame_count(length) - length)
            )
            out = self.network(padded.unsqueeze(0))[0, :length]
            keep = slice(
                chunk.keep_start - chunk.start, chunk.keep_end - chunk.start
            )
            parts.append(out[keep].float().cpu().numpy())
        return np.concatenate(parts)


@cache
def load_rmvpe(weights: Path = DEFAULT_WEIGHTS_PATH) -> _Rmvpe:
    """Loads the model once per worker process; later jobs reuse it."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _Rmvpe(weights, device)


def _read_mono_16k(vocals: Path) -> np.ndarray:
    audio, rate = soundfile.read(vocals, dtype="float32", always_2d=True)
    mono = audio.mean(axis=1)
    if rate != maths.SAMPLE_RATE:
        divisor = math.gcd(rate, maths.SAMPLE_RATE)
        mono = resample_poly(
            mono, maths.SAMPLE_RATE // divisor, rate // divisor
        )
    return np.clip(mono, -1.0, 1.0).astype(np.float32)


def pitch_curve(
    vocals: Path, weights: Path = DEFAULT_WEIGHTS_PATH
) -> list[float]:
    """One MIDI number per 10 ms frame from t = 0; 0 where RMVPE hears no
    voice."""
    model = load_rmvpe(weights)
    audio = _read_mono_16k(vocals)
    salience = model.salience(model.mel(audio))
    return maths.salience_to_midi(salience)
