"""
FAKE MODEL — fastapi-service/app/models/fake_model.py

WHAT: A deterministic stand-in for a real ML model. Given the same input
      text, it always produces the same output — no randomness, no real
      model weights, no GPU.

WHY IT EXISTS: the point of this project is the COMMUNICATION
      architecture (Express <-> gRPC <-> FastAPI), not machine learning.
      A real model would add cost, latency variance, and setup complexity
      that has nothing to do with what you're trying to learn here. This
      module is intentionally fake and says so in its own name.

WHO CALLS THIS: services/analysis_service.py only. Nothing else should
      import this directly — both the REST route (Phase 1) and the gRPC
      handler (Phase 2+) will go through the service layer, never
      straight to the model.
"""

import time
from app.core.config import settings


def run_fake_inference(text: str, analysis_type: str) -> dict:
    """
    Simulates model latency with a fixed sleep, then produces a
    deterministic "analysis" from simple text statistics. Real inference
    would replace only the BODY of this function — nothing above it in
    the call chain (service layer, routes, gRPC handlers) would need to
    change.
    """
    start = time.perf_counter()

    # Simulate the model "thinking". In a real service this would be an
    # actual forward pass; here it's just a sleep, so processing_time_ms
    # in the response is meaningfully non-zero and you can watch it move.
    time.sleep(settings.fake_model_latency_ms / 1000)

    words = text.split()
    word_count = len(words)

    summary = f"This document contains {word_count} words. First words: {' '.join(words[:8])}..."

    # Deterministic "sentiment": a fixed, explainable rule rather than
    # real sentiment analysis, so you always know exactly why you got the
    # answer you got.
    sentiment = "positive" if "great" in text.lower() or "good" in text.lower() else "neutral"

    # Deterministic "keywords": the 5 longest unique words, longest first.
    unique_words = sorted(
        {w.strip(".,!?").lower() for w in words if w.strip(".,!?")},
        key=len,
        reverse=True,
    )
    keywords = unique_words[:5]

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return {
        "summary": summary,
        "sentiment": sentiment,
        "keywords": keywords,
        "processing_time_ms": elapsed_ms,
    }
