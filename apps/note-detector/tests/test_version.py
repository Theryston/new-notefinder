from note_detector.version import detector_version


def test_names_the_build_by_its_git_sha():
    environ = {"NOTE_DETECTOR_GIT_SHA": "abc1234"}

    assert detector_version(environ) == "note-detector@abc1234"


def test_a_missing_sha_is_unknown():
    assert detector_version({}) == "note-detector@unknown"


def test_a_blank_sha_is_unknown():
    environ = {"NOTE_DETECTOR_GIT_SHA": "  "}

    assert detector_version(environ) == "note-detector@unknown"
