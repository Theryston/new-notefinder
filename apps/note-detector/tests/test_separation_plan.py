import numpy as np
import pytest

from note_detector.separation_plan import (
    OverlapAdd,
    chunk_batches,
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


def test_the_padded_length_ends_exactly_at_the_last_chunk():
    plan = plan_chunks(total_samples=5003, chunk_size=800, overlap=4)

    assert plan.padded_length == 5200
    assert plan.starts[-1] == 4400


@pytest.mark.parametrize(
    ("total", "chunk", "overlap"),
    [
        (0, 800, 4),
        (-1, 800, 4),
        (100, 0, 4),
        (100, -800, 4),
        (100, 800, 0),
        (100, 800, -4),
        (100, 801, 4),
    ],
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


def test_chunks_are_batched_in_order_with_a_smaller_last_batch():
    signal = np.arange(1650, dtype=np.float32)[None, :]
    plan = plan_chunks(1650, 800, 4)

    batches = list(chunk_batches(signal, plan, batch_size=4))

    assert [starts for starts, _ in batches] == [
        (0, 200, 400, 600),
        (800, 1000),
    ]
    first, second = batches[0][1], batches[1][1]
    assert first.shape == (4, 1, 800)
    assert second.shape == (2, 1, 800)
    assert first[1, 0, 0] == 200
    assert second[1, 0, 649] == 1649


def test_the_last_chunk_is_padded_with_silence():
    signal = np.ones((2, 1650), np.float32)
    plan = plan_chunks(1650, 800, 4)

    last = list(chunk_batches(signal, plan, batch_size=4))[-1][1][-1]

    assert last[:, :650].min() == 1
    assert last[:, 650:].max() == 0
