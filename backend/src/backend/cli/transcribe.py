import argparse
import sys
import time
from pathlib import Path

from backend.core.config import settings
from backend.services.audio_decoder import decode_audio
from backend.services.transcription import TranscriptionService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m backend.cli.transcribe",
        description="VERBAMIND Offline Speech Transcription CLI (faster-whisper / CTranslate2)",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--session-id",
        type=str,
        help="Session identifier located in storage/recordings/<session_id>",
    )
    group.add_argument(
        "--audio-path",
        type=Path,
        help="Direct path to an audio file (.webm, .wav, .ogg, .m4a)",
    )

    parser.add_argument(
        "--take",
        type=int,
        default=1,
        help="Take number when querying by session ID (default: 1)",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=settings.WHISPER_MODEL_DIR,
        help=f"Directory containing faster-whisper model weights (default: {settings.WHISPER_MODEL_DIR})",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=settings.WHISPER_DEVICE,
        help="Compute device: 'cpu' or 'cuda' (default: cpu)",
    )
    parser.add_argument(
        "--compute-type",
        type=str,
        default=settings.WHISPER_COMPUTE_TYPE,
        help="Quantization precision: 'int8', 'float16', 'default' (default: int8)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Do not save transcript JSON into storage",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    # 1. Resolve Audio Target
    if args.audio_path:
        audio_file = args.audio_path
        session_id = audio_file.parent.name
        take_num = args.take
    else:
        session_id = args.session_id
        take_num = args.take
        session_dir = settings.STORAGE_DIR / session_id
        # Look for take_{take_num}.webm, .wav, etc.
        candidates = list(session_dir.glob(f"take_{take_num}.*"))
        if not candidates:
            print(f"[ERROR] No recording found for session '{session_id}' take {take_num} in {session_dir}", file=sys.stderr)
            return 1
        audio_file = candidates[0]

    if not audio_file.exists():
        print(f"[ERROR] Audio file not found: {audio_file}", file=sys.stderr)
        return 1

    print("=" * 70)
    print("VERBAMIND OFFLINE SPEECH TRANSCRIPTION ENGINE")
    print("=" * 70)
    print(f"Target Audio:      {audio_file.name} ({audio_file.stat().st_size / 1024:.1f} KB)")
    print(f"Session / Take:    {session_id} / Take #{take_num}")
    print(f"Model Directory:   {args.model_dir}")
    print(f"Device / Precision:{args.device} / {args.compute_type}")
    print("-" * 70)

    # 2. Local Audio Decoding via PyAV
    try:
        t_dec_start = time.perf_counter()
        decoded = decode_audio(
            source=audio_file,
            max_duration_sec=settings.MAX_RECORDING_SECONDS,
            target_sample_rate=settings.TARGET_SAMPLE_RATE,
        )
        t_dec = time.perf_counter() - t_dec_start
        print(f"[1/2] Decoded in {t_dec:.3f}s: {decoded.codec.upper()} -> 16kHz mono ({decoded.duration_seconds}s)")
    except Exception as exc:
        print(f"[ERROR] Audio decoding failed: {exc}", file=sys.stderr)
        return 1

    # 3. Local Whisper Inference
    try:
        service = TranscriptionService(
            model_dir=args.model_dir,
            device=args.device,
            compute_type=args.compute_type,
        )
        print("[2/2] Running local faster-whisper inference (CTranslate2 int8)...")
        result = service.transcribe_audio_array(
            audio_array=decoded.audio_array,
            duration_seconds=decoded.duration_seconds,
        )
    except Exception as exc:
        print(f"[ERROR] Transcription inference failed: {exc}", file=sys.stderr)
        return 1

    rtf = result.processing_time_seconds / result.duration_seconds if result.duration_seconds > 0 else 0.0

    print("=" * 70)
    print("RECOGNIZED TRANSCRIPT")
    print("=" * 70)
    print(result.text if result.text else "(No speech detected)")
    print("-" * 70)
    print(f"Metrics: Duration: {result.duration_seconds}s | Processing Time: {result.processing_time_seconds}s | RTF: {rtf:.2f}x")
    print(f"Segments: {len(result.segments)} | Words: {result.word_count} | Language: {result.language} ({result.language_probability:.2f})")
    print("-" * 70)

    # 4. Display Segment & Word Alignments Sample
    print("SEGMENT & WORD ALIGNMENTS (SAMPLE)")
    for seg in result.segments[:3]:
        print(f"  [{seg.start:6.2f}s -> {seg.end:6.2f}s] {seg.text}")
        if seg.words:
            word_str = " ".join(f"{w.word}[{w.start:.2f}-{w.end:.2f}]" for w in seg.words[:6])
            if len(seg.words) > 6:
                word_str += " ..."
            print(f"      Words: {word_str}")

    if len(result.segments) > 3:
        print(f"  ... ({len(result.segments) - 3} more segments)")

    # 5. Storage Persistence
    if not args.no_save:
        transcript_path = service.save_transcript(
            session_id=session_id,
            take_number=take_num,
            result=result,
        )
        print("-" * 70)
        print(f"Saved Transcript:  {transcript_path.name} in private session storage.")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
