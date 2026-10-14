from pathlib import Path

import numpy as np
import pytest

from note_detector.game_io import (
    DEFAULT_DIR,
    estimator_feeds,
    game_directory,
    mono_vocals,
    only_inputs,
    region_count,
    segmenter_feeds,
)
from note_detector.game_pipeline import Encoded


def encoded() -> Encoded:
    return Encoded(
        np.zeros((1, 4, 2), dtype=np.float32),
        np.ones((1, 4, 2), dtype=np.float32),
        np.ones((1, 4), dtype=bool),
    )


def test_the_directory_defaults_to_the_one_the_image_build_fills():
    assert game_directory({}) == DEFAULT_DIR
    assert DEFAULT_DIR.parts[-2:] == ("weights", "game-medium")


def test_the_directory_can_be_set_by_the_environment():
    environ = {"NOTE_DETECTOR_GAME_DIR": "/models/game"}

    assert game_directory(environ) == Path("/models/game")


def test_stereo_vocals_are_averaged_to_mono():
    samples = np.array([[1.0, 3.0], [-2.0, 2.0]], dtype=np.float32)

    np.testing.assert_array_equal(
        mono_vocals(samples, 44100, 44100), [2.0, 0.0]
    )


def test_vocals_at_another_rate_than_the_model_s_fail():
    with pytest.raises(ValueError, match="48000 Hz, GAME expects 44100 Hz"):
        mono_vocals(np.zeros((4, 2), dtype=np.float32), 48000, 44100)


def test_a_graph_only_gets_the_inputs_it_has():
    feeds = {"x_seg": np.zeros(1), "language": np.zeros(1)}

    assert list(only_inputs(feeds, {"x_seg", "t"})) == ["x_seg"]


def test_the_segmenter_gets_every_input_with_its_dtype():
    known = np.zeros((1, 4), dtype=bool)
    previous = np.ones((1, 4), dtype=bool)
    data = encoded()

    feeds = segmenter_feeds(data, known, previous, (0.375, 2))

    assert set(feeds) == {
        "x_seg",
        "language",
        "known_boundaries",
        "prev_boundaries",
        "t",
        "maskT",
        "threshold",
        "radius",
    }
    assert feeds["x_seg"] is data.x_seg
    assert feeds["maskT"] is data.mask
    assert feeds["known_boundaries"] is known
    assert feeds["prev_boundaries"] is previous
    assert feeds["language"].tolist() == [0]
    assert feeds["language"].dtype == np.int64
    assert feeds["t"].tolist() == [0.375]
    assert feeds["t"].dtype == np.float32
    assert feeds["threshold"] == np.float32(0.2)
    assert feeds["threshold"].dtype == np.float32
    assert feeds["radius"] == 2
    assert feeds["radius"].dtype == np.int64
    assert feeds["radius"].ndim == 0


def test_a_boundary_adds_one_region():
    assert region_count(np.array([[False, True, False, True]])) == 3
    assert region_count(np.zeros((1, 4), dtype=bool)) == 1


def test_the_estimator_gets_a_mask_of_the_regions():
    boundaries = np.array([[False, True, False, True]])
    data = encoded()

    feeds = estimator_feeds(data, boundaries)

    assert set(feeds) == {"x_est", "boundaries", "maskT", "maskN", "threshold"}
    assert feeds["x_est"] is data.x_est
    assert feeds["boundaries"] is boundaries
    assert feeds["maskT"] is data.mask
    assert feeds["maskN"].tolist() == [[True, True, True]]
    assert feeds["maskN"].dtype == bool
    assert feeds["threshold"] == np.float32(0.2)
    assert feeds["threshold"].dtype == np.float32
