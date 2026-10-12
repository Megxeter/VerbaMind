"""
CLI utility to compare offline Whisper models (base.en vs small.en) on the same audio recording.

Invariants:
- Local offline execution only (CTranslate2 CPU int8).
- Zero initial_prompt biasing (pure unbiased recognition).
- Raw model outputs preserved without post-hoc name alteration.
- Word Error Rate (WER) computed against verified reference transcript.
- WER is an ASR engineering quality metric, NOT a user pronunciation score.
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

from backend.core.config import settings
from backend.services.audio_decoder import decode_audio
from backend.services.transcription import TranscriptionService


def compute_wer(reference: str, hypothesis: str) -> dict:
    """
    Standard dynamic programming alignment for Word Error Rate (WER).
    Returns substitutions (S), deletions (D), insertions (I), and WER = (S + D + I) / N.
    """
    ref_words = re.findall(r"\b[\w'-]+\b", reference.lower())
    hyp_words = re.findall(r"\b[\w'-]+\b", hypothesis.lower())

    r_len = len(ref_words)
    h_len = len(hyp_words)

    if r_len == 0:
        return {
            "wer": 0.0 if h_len == 0 else 1.0,
            "substitutions": 0,
            "deletions": 0,
            "insertions": h_len,
            "ref_count": 0,
            "hyp_count": h_len,
        }

    # d[i][j] = (total_errors, substitutions, deletions, insertions)
    d = [[(0, 0, 0, 0) for _ in range(h_len + 1)] for _ in range(r_len + 1)]
    for i in range(1, r_len + 1):
        d[i][0] = (i, 0, i, 0)
    for j in range(1, h_len + 1):
        d[0][j] = (j, 0, 0, j)

    for i in range(1, r_len + 1):
        for j in range(1, h_len + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                d[i][j] = d[i - 1][j - 1]
            else:
                sub = (d[i - 1][j - 1][0] + 1, d[i - 1][j - 1][1] + 1, d[i - 1][j - 1][2], d[i - 1][j - 1][3])
                dele = (d[i - 1][j][0] + 1, d[i - 1][j][1], d[i - 1][j][2] + 1, d[i - 1][j][3])
                ins = (d[i][j - 1][0] + 1, d[i][j - 1][1], d[i][j - 1][2], d[i][j - 1][3] + 1)
                d[i][j] = min(sub, dele, ins, key=lambda x: x[0])

    dist, s, del_cnt, ins_cnt = d[r_len][h_len]
    wer = dist / r_len
    return {
        "wer": round(wer, 4),
        "substitutions": s,
        "deletions": del_cnt,
        "insertions": ins_cnt,
        "ref_count": r_len,
        "hyp_count": h_len,
    }


def evaluate_model(
    model_dir: Path,
    model_name: str,
    audio_path: Path,
    reference_text: str | None = None,
) -> dict:
    """Run offline transcription on an audio file using specified model directory."""
    print(f"\n--- Loading and Evaluating [{model_name}] ---")
    start_load = time.perf_counter()
    service = TranscriptionService(
        model_dir=model_dir,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
        cpu_threads=settings.WHISPER_CPU_THREADS,
    )
    load_time = time.perf_counter() - start_load
    print(f"  Model loaded in {load_time:.2f}s")

    result = service.transcribe_file(audio_path)
    rtf = round(result.processing_time_seconds / result.duration_seconds, 3) if result.duration_seconds > 0 else 0.0

    eval_data = {
        "model_name": model_name,
        "model_dir": str(model_dir.name),
        "device": result.device,
        "compute_type": result.compute_type,
        "threads": settings.WHISPER_CPU_THREADS,
        "audio_duration_seconds": result.duration_seconds,
        "processing_time_seconds": result.processing_time_seconds,
        "real_time_factor": rtf,
        "raw_transcript": result.text,
        "word_count": result.word_count,
        "segments_count": len(result.segments),
    }

    if reference_text:
        wer_stats = compute_wer(reference_text, result.text)
        eval_data["wer_stats"] = wer_stats

    return eval_data


def main():
    parser = argparse.ArgumentParser(description="Compare base.en and small.en models on an audio recording")
    parser.add_argument("--audio-path", type=str, required=True, help="Path to audio recording (WebM, WAV, etc.)")
    parser.add_argument("--reference-text", type=str, default=None, help="Verified ground truth reference text")
    parser.add_argument("--reference-file", type=str, default=None, help="Path to file containing verified reference text")
    args = parser.parse_args()

    audio_file = Path(args.audio_path).resolve()
    if not audio_file.is_file():
        print(f"Error: Audio file not found at {audio_file}", file=sys.stderr)
        sys.exit(1)

    ref_text = args.reference_text
    if args.reference_file:
        ref_path = Path(args.reference_file).resolve()
        if ref_path.is_file():
            ref_text = ref_path.read_text(encoding="utf-8").strip()

    base_dir = settings.WHISPER_MODEL_DIR  # models/whisper/base.en
    small_dir = settings.WHISPER_MODEL_DIR.parent / "small.en"

    if not (base_dir / "model.bin").is_file():
        print(f"Error: base.en model not found in {base_dir}", file=sys.stderr)
        sys.exit(1)

    if not (small_dir / "model.bin").is_file():
        print(f"Error: small.en model not found in {small_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Comparing Whisper base.en vs small.en on: {audio_file.name}")
    print(f"Audio Size: {audio_file.stat().st_size} bytes")

    base_eval = evaluate_model(base_dir, "base.en", audio_file, ref_text)
    small_eval = evaluate_model(small_dir, "small.en", audio_file, ref_text)

    print("\n" + "=" * 80)
    print("MODEL COMPARISON SUMMARY")
    print("=" * 80)
    print(f"Audio Duration: {base_eval['audio_duration_seconds']:.2f}s")
    if ref_text:
        print(f"Reference Text: {ref_text}")
    print("-" * 80)
    print(f"BASE.EN:")
    print(f"  Raw Output:      {base_eval['raw_transcript']}")
    print(f"  Latency:         {base_eval['processing_time_seconds']:.2f}s (RTF: {base_eval['real_time_factor']}x)")
    print(f"  Word Count:      {base_eval['word_count']}")
    if "wer_stats" in base_eval:
        ws = base_eval["wer_stats"]
        print(f"  WER:             {ws['wer'] * 100:.1f}% (Sub: {ws['substitutions']}, Del: {ws['deletions']}, Ins: {ws['insertions']}, Ref Words: {ws['ref_count']})")

    print("-" * 80)
    print(f"SMALL.EN:")
    print(f"  Raw Output:      {small_eval['raw_transcript']}")
    print(f"  Latency:         {small_eval['processing_time_seconds']:.2f}s (RTF: {small_eval['real_time_factor']}x)")
    print(f"  Word Count:      {small_eval['word_count']}")
    if "wer_stats" in small_eval:
        ws = small_eval["wer_stats"]
        print(f"  WER:             {ws['wer'] * 100:.1f}% (Sub: {ws['substitutions']}, Del: {ws['deletions']}, Ins: {ws['insertions']}, Ref Words: {ws['ref_count']})")
    print("=" * 80)

    # Save summary report to JSON
    report_path = audio_file.parent / f"comparison_{audio_file.stem}_base_vs_small.json"
    report_data = {
        "audio_file": audio_file.name,
        "audio_duration_seconds": base_eval["audio_duration_seconds"],
        "reference_text": ref_text,
        "base_en": base_eval,
        "small_en": small_eval,
    }
    report_path.write_text(json.dumps(report_data, indent=2), encoding="utf-8")
    print(f"Detailed comparison saved to: {report_path.name}")


if __name__ == "__main__":
    main()
