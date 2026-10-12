import pytest
from backend.services.audio_validator import detect_audio_container, EBML_MAGIC, OGG_MAGIC, RIFF_MAGIC, WAVE_MAGIC, FTYP_MAGIC


def test_detect_webm_container():
    data = EBML_MAGIC + b"\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\x82\x84webm"
    assert detect_audio_container(data) == "audio/webm"


def test_detect_ogg_container():
    data = OGG_MAGIC + b"\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    assert detect_audio_container(data) == "audio/ogg"


def test_detect_wav_container():
    data = RIFF_MAGIC + b"\x24\x00\x00\x00" + WAVE_MAGIC + b"fmt \x10\x00\x00\x00"
    assert detect_audio_container(data) == "audio/wav"


def test_detect_mp4_container():
    data = b"\x00\x00\x00\x1c" + FTYP_MAGIC + b"M4A \x00\x00\x00\x00M4A mp42isom"
    assert detect_audio_container(data) == "audio/mp4"


def test_reject_short_payload():
    assert detect_audio_container(b"short") is None


def test_reject_arbitrary_text_or_binary():
    assert detect_audio_container(b"This is just a plain text document masquerading as audio.") is None
    assert detect_audio_container(b"\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f") is None
