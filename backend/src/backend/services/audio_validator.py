from typing import Optional

# Magic byte signatures for authorized browser recording containers
EBML_MAGIC = b"\x1a\x45\xdf\xa3"  # WebM container (RFC 8794 EBML Header ID)
OGG_MAGIC = b"OggS"               # Ogg container (RFC 3533 Capture Pattern)
RIFF_MAGIC = b"RIFF"              # Resource Interchange File Format (WAV container)
WAVE_MAGIC = b"WAVE"              # WAV sub-format identifier
FTYP_MAGIC = b"ftyp"              # ISO Base Media File Format (MP4 / M4A)


def detect_audio_container(data: bytes) -> Optional[str]:
    """Inspect binary header bytes to determine the actual audio container format.
    
    Security Guarantee:
    Does NOT trust client-supplied filenames, file extensions, or HTTP Content-Type headers.
    Returns the canonical MIME type string, or None if the payload does not match
    a verified container signature.
    """
    if len(data) < 12:
        return None

    # Check WebM / MKV (EBML header)
    if data.startswith(EBML_MAGIC):
        return "audio/webm"

    # Check Ogg
    if data.startswith(OGG_MAGIC):
        return "audio/ogg"

    # Check WAV (RIFF header + WAVE sub-identifier at offset 8)
    if data.startswith(RIFF_MAGIC) and data[8:12] == WAVE_MAGIC:
        return "audio/wav"

    # Check MP4 / M4A (ftyp box at byte offset 4)
    if data[4:8] == FTYP_MAGIC:
        return "audio/mp4"

    return None
