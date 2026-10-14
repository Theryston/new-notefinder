"""The Pitch curve step: RMVPE on the separated vocals.

Glue between torch, the vendored network and the pure maths in
`rmvpe_math.py`; it needs the weights, so the unit tests omit it and a marked
check exercises it when the weights are present. The inference follows the RVC
project's (MIT): 16 kHz mono, a centered STFT with a 10 ms hop, the network
run in fp32, then the local-average decoding with RMVPE's own voicing.
"""

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
            nn.Linear(512, maths.N_BINS),
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
        self.mel_basis = (
            torch.from_numpy(maths.mel_filterbank()).float().to(device)
        )
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
        return torch.log(
            torch.clamp(self.mel_basis @ spectrum.abs(), maths.LOG_FLOOR)
        )

    @torch.inference_mode()
    def salience(self, mel: torch.Tensor) -> np.ndarray:
        # One pass over the whole Track, as RVC does: the GRU reads the full
        # context, and ~30k frames of a 5-minute Track fit on the GPU.
        n_frames = mel.shape[-1]
        padded = functional.pad(mel, (0, maths.frame_padding(n_frames)))
        return self.network(padded.unsqueeze(0))[0, :n_frames].cpu().numpy()


@cache
def load_rmvpe(weights: Path = DEFAULT_WEIGHTS_PATH) -> _Rmvpe:
    """Loads the model once per worker process; later jobs reuse it."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _Rmvpe(weights, device)


def _read_mono_16k(vocals: Path) -> np.ndarray:
    audio, rate = soundfile.read(vocals, dtype="float32", always_2d=True)
    mono = audio.mean(axis=1)
    if rate != maths.SAMPLE_RATE:
        up, down = maths.resample_ratio(rate)
        mono = resample_poly(mono, up, down)
    return np.clip(mono, -1.0, 1.0).astype(np.float32)


def pitch_curve(
    vocals: Path, weights: Path = DEFAULT_WEIGHTS_PATH
) -> list[float]:
    """One MIDI number per 10 ms frame from t = 0; 0 where RMVPE hears no
    voice. Vocals shorter than 512 samples (32 ms) are too short for the
    centered STFT and fail the job."""
    model = load_rmvpe(weights)
    audio = _read_mono_16k(vocals)
    salience = model.salience(model.mel(audio))
    maths.check_frame_count(salience.shape[0], len(audio))
    return maths.salience_to_midi(salience)
