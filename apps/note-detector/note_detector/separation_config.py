"""What the vocal separation reads from the model's published config.

The config is ZFTurbo's training config for the "Kim" checkpoint. Most of it
is training detail; this module takes the keys the inference needs, checks
the ones that must hold for the vendored model to be the right one, and
fails on any key it has not seen, so a changed config is noticed instead of
silently half-applied.
"""

from collections.abc import Mapping
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Any

# The model reads and writes stereo.
AUDIO_CHANNELS = 2

# `weights.py` downloads the files named by `separation-weights.json` here.
DEFAULT_DIR = "/app/weights/mel-band-roformer"
DIR_VARIABLE = "NOTE_DETECTOR_SEPARATION_DIR"
WEIGHTS_FILE = "MelBandRoformer.ckpt"
CONFIG_FILE = "config.yaml"


def separation_directory(environ: Mapping[str, str]) -> Path:
    return Path(environ.get(DIR_VARIABLE, DEFAULT_DIR))


@dataclass(frozen=True)
class MelBandRoformerConfig:
    """The `model` keys that shape the network."""

    dim: int
    depth: int
    time_transformer_depth: int
    freq_transformer_depth: int
    num_bands: int
    dim_head: int
    heads: int
    sample_rate: int
    stft_n_fft: int
    stft_hop_length: int
    stft_win_length: int
    mask_estimator_depth: int
    mlp_expansion_factor: int = 4


@dataclass(frozen=True)
class SeparationConfig:
    model: MelBandRoformerConfig
    chunk_size: int
    sample_rate: int
    batch_size: int


# Keys that are known and deliberately not read, with why.
_IGNORED_MODEL_KEYS = frozenset(
    {
        # The vendored model has no dropout (inference) and always uses
        # PyTorch's scaled dot-product attention.
        "attn_dropout",
        "ff_dropout",
        "flash_attn",
        # Derived from `stft_n_fft`.
        "dim_freqs_in",
        # Checked below instead of read.
        "stereo",
        "num_stems",
        "stft_normalized",
        # Training loss only.
        "multi_stft_resolution_loss_weight",
        "multi_stft_resolutions_window_sizes",
        "multi_stft_hop_size",
        "multi_stft_normalized",
    }
)
# The spectrogram sizes duplicate the model's own STFT settings; the rest is
# data-loading detail for training.
_IGNORED_AUDIO_KEYS = frozenset(
    {"dim_f", "dim_t", "hop_length", "n_fft", "min_mean_abs"}
)
_AUDIO_KEYS = frozenset({"chunk_size", "num_channels", "sample_rate"})
# We always run overlap 4 (`separation_plan`), not the config's.
_IGNORED_INFERENCE_KEYS = frozenset({"dim_t", "num_overlap"})
_INFERENCE_KEYS = frozenset({"batch_size"})


def _reject_unknown(section: str, found: Mapping[str, object], known: set[str]):
    unknown = sorted(set(found) - known)
    if unknown:
        raise ValueError(f"unknown {section} config keys: {', '.join(unknown)}")


def _section(published: Mapping[str, object], name: str) -> Mapping[str, Any]:
    section = published.get(name)
    if not isinstance(section, Mapping):
        raise ValueError(f"the config has no {name} section")
    return section


def parse_separation_config(
    published: Mapping[str, object],
) -> SeparationConfig:
    """Validates the published config and takes what the inference needs."""
    audio, model, inference = (
        _section(published, name) for name in ("audio", "model", "inference")
    )

    model_keys = {field.name for field in fields(MelBandRoformerConfig)}
    _reject_unknown("model", model, model_keys | _IGNORED_MODEL_KEYS)
    _reject_unknown("audio", audio, _AUDIO_KEYS | _IGNORED_AUDIO_KEYS)
    _reject_unknown(
        "inference", inference, _INFERENCE_KEYS | _IGNORED_INFERENCE_KEYS
    )

    if (
        audio["num_channels"] != AUDIO_CHANNELS
        or model.get("stereo") is not True
    ):
        raise ValueError("the vocals model is stereo")
    if model.get("num_stems") != 1 or model.get("stft_normalized") is not False:
        raise ValueError(
            "the vendored model is one stem with an unnormalized STFT"
        )

    return SeparationConfig(
        model=MelBandRoformerConfig(
            **{key: model[key] for key in model if key in model_keys}
        ),
        chunk_size=audio["chunk_size"],
        sample_rate=audio["sample_rate"],
        batch_size=inference["batch_size"],
    )
