from pathlib import Path

import pytest

from note_detector.separation_config import (
    parse_separation_config,
    separation_directory,
)


def published():
    """The published config of the Kim checkpoint (ZFTurbo's repository)."""
    return {
        "audio": {
            "chunk_size": 352800,
            "dim_f": 1024,
            "dim_t": 256,
            "hop_length": 441,
            "n_fft": 2048,
            "num_channels": 2,
            "sample_rate": 44100,
            "min_mean_abs": 0.0,
        },
        "model": {
            "dim": 384,
            "depth": 6,
            "stereo": True,
            "num_stems": 1,
            "time_transformer_depth": 1,
            "freq_transformer_depth": 1,
            "num_bands": 60,
            "dim_head": 64,
            "heads": 8,
            "attn_dropout": 0,
            "ff_dropout": 0,
            "flash_attn": True,
            "dim_freqs_in": 1025,
            "sample_rate": 44100,
            "stft_n_fft": 2048,
            "stft_hop_length": 441,
            "stft_win_length": 2048,
            "stft_normalized": False,
            "mask_estimator_depth": 2,
            "multi_stft_resolution_loss_weight": 1.0,
            "multi_stft_resolutions_window_sizes": (4096, 2048),
            "multi_stft_hop_size": 147,
            "multi_stft_normalized": False,
        },
        "inference": {"batch_size": 4, "dim_t": 256, "num_overlap": 2},
        "training": {"batch_size": 4},
    }


def test_takes_what_the_inference_needs():
    config = parse_separation_config(published())

    assert config.chunk_size == 352800
    assert config.sample_rate == 44100
    assert config.batch_size == 4
    assert config.model.dim == 384
    assert config.model.depth == 6
    assert config.model.num_bands == 60
    assert config.model.stft_hop_length == 441
    assert config.model.mask_estimator_depth == 2
    assert config.model.mlp_expansion_factor == 4


@pytest.mark.parametrize("section", ["audio", "model", "inference"])
def test_an_unknown_key_fails_instead_of_being_dropped(section):
    config = published()
    config[section]["surprise"] = 1

    with pytest.raises(ValueError, match=f"unknown {section} config keys"):
        parse_separation_config(config)


@pytest.mark.parametrize("section", ["audio", "model", "inference"])
def test_a_missing_section_fails(section):
    config = published()
    del config[section]

    with pytest.raises(ValueError, match=f"no {section} section"):
        parse_separation_config(config)


@pytest.mark.parametrize(
    ("section", "key", "value", "message"),
    [
        ("audio", "num_channels", 1, "stereo"),
        ("model", "stereo", False, "stereo"),
        ("model", "num_stems", 2, "one stem"),
        ("model", "stft_normalized", True, "one stem"),
    ],
)
def test_a_model_the_vendored_class_cannot_be_fails(
    section, key, value, message
):
    config = published()
    config[section][key] = value

    with pytest.raises(ValueError, match=message):
        parse_separation_config(config)


def test_a_missing_model_key_fails():
    config = published()
    del config["model"]["dim"]

    with pytest.raises(TypeError):
        parse_separation_config(config)


def test_the_directory_defaults_to_the_image_path():
    assert separation_directory({}) == Path("/app/weights/mel-band-roformer")


def test_the_directory_can_be_overridden():
    environ = {"NOTE_DETECTOR_SEPARATION_DIR": "/tmp/weights"}

    assert separation_directory(environ) == Path("/tmp/weights")
