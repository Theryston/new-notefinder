import numpy as np
import pytest

from note_detector.separation_plan import (
    OverlapAdd,
    overlap_weights,
    plan_chunks,
)


def test_a_signal_shorter_than_a_chunk_is_one_padded_chunk():
    plan = plan_chunks(total_samples=300, chunk_size=800, overlap=4)

    assert plan.starts == (0,)
    assert plan.padded_length == 800


def test_a_signal_of_exactly_one_chunk_needs_no_padding():
    plan = plan_chunks(total_samples=800, chunk_size=800, overlap=4)

    assert plan.starts == (0,)
    assert plan.padded_length == 800


def test_overlap_4_hops_a_quarter_chunk():
    plan = plan_chunks(total_samples=1600, chunk_size=800, overlap=4)

    assert plan.starts == (0, 200, 400, 600, 800)
    assert plan.padded_length == 1600


def test_a_tail_that_is_not_a_multiple_of_the_hop_is_padded():
    plan = plan_chunks(total_samples=1650, chunk_size=800, overlap=4)

    assert plan.starts == (0, 200, 400, 600, 800, 1000)
    assert plan.padded_length == 1800


def test_one_extra_sample_past_a_chunk_adds_a_chunk():
    plan = plan_chunks(total_samples=801, chunk_size=800, overlap=4)

    assert plan.starts == (0, 200)
    assert plan.padded_length == 1000


def test_every_sample_is_covered_by_a_full_chunk():
    plan = plan_chunks(total_samples=5003, chunk_size=800, overlap=4)

    assert plan.padded_length >= 5003
    assert all(
        later - earlier == 200
        for earlier, later in zip(plan.starts, plan.starts[1:], strict=False)
    )


@pytest.mark.parametrize(
    ("total", "chunk", "overlap"),
    [(0, 800, 4), (-1, 800, 4), (100, 0, 4), (100, 800, 0), (100, 801, 4)],
)
def test_rejects_an_impossible_plan(total, chunk, overlap):
    with pytest.raises(ValueError):
        plan_chunks(total, chunk, overlap)


def test_weights_are_symmetric_peak_in_the_middle_and_never_zero():
    weights = overlap_weights(8)

    assert weights.dtype == np.float32
    assert np.allclose(weights, weights[::-1])
    assert weights.min() > 0
    assert weights.argmax() in (3, 4)
    assert np.isclose(weights[0], 1 / 8)


def blend(signal, chunk_size, overlap):
    plan = plan_chunks(signal.shape[1], chunk_size, overlap)
    padded = np.pad(signal, ((0, 0), (0, plan.padded_length - signal.shape[1])))
    blender = OverlapAdd(plan, channels=signal.shape[0])
    for start in plan.starts:
        blender.add(start, padded[:, start : start + chunk_size])
    return blender.result(signal.shape[1])


@pytest.mark.parametrize("total", [300, 800, 1600, 1650, 2003])
def test_blending_unchanged_chunks_returns_the_input(total):
    rng = np.random.default_rng(0)
    signal = rng.standard_normal((2, total)).astype(np.float32)

    blended = blend(signal, chunk_size=800, overlap=4)

    assert blended.shape == signal.shape
    assert np.allclose(blended, signal, atol=1e-5)


def test_blending_weights_the_middle_of_a_chunk_over_its_edges():
    plan = plan_chunks(total_samples=1000, chunk_size=800, overlap=4)
    blender = OverlapAdd(plan, channels=1)
    blender.add(0, np.zeros((1, 800), np.float32))
    blender.add(200, np.ones((1, 800), np.float32))

    result = blender.result(1000)

    # The start is covered by the first chunk only; the middle by both.
    assert result[0, 0] == 0
    weights = overlap_weights(800)
    expected = weights[300] / (weights[500] + weights[300])
    assert result[0, 500] == pytest.approx(expected)
    assert result[0, 999] == 1
