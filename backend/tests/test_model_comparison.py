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


def test_wer_empty_reference_or_hypothesis():
    assert compute_wer("", "")["wer"] == 0.0
    assert compute_wer("word", "")["wer"] == 1.0
    assert compute_wer("", "word")["wer"] == 1.0
