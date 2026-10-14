import numpy as np

from note_detector.game_decode import (
    RegionScores,
    boundary_radius_frames,
    clip_notes,
    combine_notes,
    d3pm_times,
    region_durations,
    sample_boundaries,
)
from note_detector.notes import Note


def bools(*values: int) -> np.ndarray:
    return np.array(values, dtype=bool)


def test_games_defaults_sample_eight_steps_from_zero():
    assert d3pm_times() == [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]


def test_each_step_refines_the_previous_boundaries():
    seen = []

    def segment(previous, t):
        seen.append((previous.tolist(), t))
        return previous.copy() | (np.arange(4) == len(seen))

    known = bools(0, 0, 0, 0)

    result = sample_boundaries(segment, known, [0.0, 0.5])

    assert seen == [([False] * 4, 0.0), ([False, True, False, False], 0.5)]
    assert result.tolist() == [False, True, True, False]


def test_no_step_leaves_the_known_boundaries():
    known = bools(0, 1)

    assert sample_boundaries(lambda p, t: p, known, []) is known


def test_a_boundary_cuts_the_frames_into_two_regions():
    boundaries = bools(0, 0, 1, 0, 0, 0)
    mask = bools(1, 1, 1, 1, 1, 0)

    durations = region_durations(boundaries, mask, 0.01)

    np.testing.assert_allclose(durations, [0.02, 0.03])


def test_no_boundary_is_one_region_over_the_masked_frames():
    durations = region_durations(bools(0, 0, 0), bools(1, 1, 0), 0.01)

    np.testing.assert_allclose(durations, [0.02])


def test_an_empty_mask_has_no_region():
    durations = region_durations(bools(0, 0), bools(0, 0), 0.01)

    assert durations.size == 0


def scores(durations, presence, pitches) -> RegionScores:
    return RegionScores(
        np.array(durations), np.array(presence, dtype=bool), np.array(pitches)
    )


def test_voiced_regions_become_notes_offset_by_the_clip_start():
    notes = clip_notes(
        scores([0.5, 0.25, 0.25], [1, 1, 1], [60.5, 62.0, 64.25]),
        offset=10.0,
        length=1.0,
    )

    assert notes == [
        Note(60.5, 10.0, 10.5),
        Note(62.0, 10.5, 10.75),
        Note(64.25, 10.75, 11.0),
    ]


def test_unvoiced_regions_are_dropped():
    notes = clip_notes(
        scores([0.5, 0.5], [0, 1], [60.0, 62.0]), offset=0, length=1.0
    )

    assert notes == [Note(62.0, 0.5, 1.0)]


def test_a_region_past_the_clip_length_is_clamped_then_dropped():
    notes = clip_notes(
        scores([0.75, 0.5, 0.5], [1, 1, 1], [60.0, 62.0, 64.0]),
        offset=2.0,
        length=1.0,
    )

    assert notes == [Note(60.0, 2.0, 2.75), Note(62.0, 2.75, 3.0)]


def test_a_clip_without_regions_has_no_notes():
    assert clip_notes(scores([], [], []), offset=0, length=1.0) == []


def test_notes_of_all_clips_come_out_in_time_order():
    notes = combine_notes([Note(62, 2, 3), Note(60, 0, 1), Note(61, 1, 2)])

    assert [n.pitch for n in notes] == [60, 61, 62]


def test_adjacent_clips_keep_their_notes_untouched():
    first = [Note(60, 0.0, 1.0)]
    second = [Note(62, 1.0, 2.0)]

    assert combine_notes(first + second) == [
        Note(60, 0.0, 1.0),
        Note(62, 1.0, 2.0),
    ]


def test_an_overlap_between_notes_is_trimmed_to_the_previous_end():
    notes = combine_notes([Note(60, 0.0, 1.5), Note(62, 1.0, 2.0)])

    assert notes == [Note(60, 0.0, 1.5), Note(62, 1.5, 2.0)]


def test_a_note_swallowed_by_the_previous_one_is_dropped():
    notes = combine_notes([Note(60, 0.0, 2.0), Note(62, 0.5, 1.0)])

    assert notes == [Note(60, 0.0, 2.0)]


def test_no_notes_combine_to_none():
    assert combine_notes([]) == []


def test_the_radius_is_twenty_milliseconds_in_frames():
    assert boundary_radius_frames(0.01) == 2
    assert boundary_radius_frames(0.02) == 1
    assert boundary_radius_frames(0.005) == 4
