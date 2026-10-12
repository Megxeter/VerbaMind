import pytest
from backend.cli.compare_models import compute_wer


def test_wer_exact_match():
    ref = "Consistent daily practice improves spoken English fluency."
    hyp = "Consistent daily practice improves spoken English fluency."
    res = compute_wer(ref, hyp)
    assert res["wer"] == 0.0
    assert res["substitutions"] == 0
    assert res["deletions"] == 0
    assert res["insertions"] == 0
    assert res["ref_count"] == 7


def test_wer_substitutions():
    ref = "My name is Yasir"
    hyp = "My name is Yasa"
    res = compute_wer(ref, hyp)
    assert res["wer"] == 0.25
    assert res["substitutions"] == 1
    assert res["deletions"] == 0
    assert res["insertions"] == 0
    assert res["ref_count"] == 4


def test_wer_deletions_and_insertions():
    ref = "I am a computer science student"
    hyp = "I computer science student today"
    # ref: 6 words ('i', 'am', 'a', 'computer', 'science', 'student')
    # hyp has deleted 'am', 'a' (2 deletions) and inserted 'today' (1 insertion)
    res = compute_wer(ref, hyp)
    assert res["deletions"] == 2
    assert res["insertions"] == 1
    assert res["substitutions"] == 0
    assert res["wer"] == round(3 / 6, 4)


def test_wer_case_and_punctuation_insensitivity():
    ref = "Hello, world! Welcome to VerbaMind."
    hyp = "hello world welcome to verbamind"
    res = compute_wer(ref, hyp)
    assert res["wer"] == 0.0
    assert res["ref_count"] == 5


def test_wer_empty_reference_is_explicitly_undefined():
    # When reference has 0 words, WER is mathematically undefined (division by zero)
    assert compute_wer("", "")["wer"] is None
    assert compute_wer("", "")["ref_count"] == 0
    assert compute_wer("", "word")["wer"] is None
    assert compute_wer("", "word")["ref_count"] == 0
    assert compute_wer("", "word")["insertions"] == 1


def test_wer_empty_hypothesis_is_full_deletion():
    # When reference has words and hypothesis is empty, WER = 1.0 (100% deletion)
    res = compute_wer("word", "")
    assert res["wer"] == 1.0
    assert res["deletions"] == 1
    assert res["substitutions"] == 0
    assert res["insertions"] == 0
    assert res["ref_count"] == 1


def test_load_reference_text_missing_file_raises_error(tmp_path):
    from backend.cli.compare_models import load_reference_text
    missing_file = tmp_path / "does_not_exist.txt"
    with pytest.raises(FileNotFoundError, match="Reference file not found"):
        load_reference_text(None, str(missing_file))


def test_load_reference_text_existing_file(tmp_path):
    from backend.cli.compare_models import load_reference_text
    ref_file = tmp_path / "ref.txt"
    ref_file.write_text("  This is ground truth. \n", encoding="utf-8")
    loaded = load_reference_text(None, str(ref_file))
    assert loaded == "This is ground truth."


def test_compute_aggregate_wer_excludes_empty_reference():
    from backend.cli.compare_models import compute_aggregate_wer
    evals = [
        # Recording 1: 10 ref words, 1 sub -> WER 0.10
        {"audio_file": "rec1.webm", "wer_stats": {"wer": 0.10, "substitutions": 1, "deletions": 0, "insertions": 0, "ref_count": 10, "hyp_count": 10}},
        # Recording 2: 20 ref words, 2 del, 1 ins -> WER 0.15
        {"audio_file": "rec2.webm", "wer_stats": {"wer": 0.15, "substitutions": 0, "deletions": 2, "insertions": 1, "ref_count": 20, "hyp_count": 19}},
        # Recording 3: 0 ref words (empty reference) -> wer is None; MUST BE EXCLUDED!
        {"audio_file": "rec3.webm", "wer_stats": {"wer": None, "substitutions": 0, "deletions": 0, "insertions": 3, "ref_count": 0, "hyp_count": 3}},
    ]
    agg = compute_aggregate_wer(evals)
    # Total valid ref words: 10 + 20 = 30
    # Total errors: (1+0+0) + (0+2+1) = 4
    # Expected aggregate WER: 4 / 30 = 0.1333
    assert agg["aggregate_wer"] == 0.1333
    assert agg["total_ref_words"] == 30
    assert agg["total_substitutions"] == 1
    assert agg["total_deletions"] == 2
    assert agg["total_insertions"] == 1
    assert agg["included_recordings"] == 2
    assert agg["excluded_recordings"] == 1


def test_compute_aggregate_wer_all_empty():
    from backend.cli.compare_models import compute_aggregate_wer
    evals = [
        {"audio_file": "rec1.webm", "wer_stats": {"wer": None, "substitutions": 0, "deletions": 0, "insertions": 1, "ref_count": 0, "hyp_count": 1}}
    ]
    agg = compute_aggregate_wer(evals)
    assert agg["aggregate_wer"] is None
    assert agg["included_recordings"] == 0
    assert agg["excluded_recordings"] == 1

