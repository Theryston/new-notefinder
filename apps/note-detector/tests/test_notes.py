from note_detector.notes import Note


def test_serializes_a_note_as_pitch_start_end():
    assert Note(61.49, 1.5, 2.25).to_dict() == {
        "pitch": 61.49,
        "start": 1.5,
        "end": 2.25,
    }
