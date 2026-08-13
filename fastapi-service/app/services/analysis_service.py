"""
SERVICE LAYER — fastapi-service/app/services/analysis_service.py

WHAT: The single place that knows how to turn "text + analysis_type" into
      an analysis result dict. Owns business-rule validation (beyond what
      Pydantic's type system alone can express) and calls the fake model.

WHY IT EXISTS: THIS is the file that Phase 1's REST route AND Phase 2's
      gRPC handler will BOTH call. This is the most important
      architectural idea on the FastAPI side of the whole project:

          FastAPI Route (REST) ─┐
                                 ├─→ Service Layer → Fake Model
          gRPC Handler          ─┘

      Two different transport protocols, one shared business logic layer.
      If analysis logic lived inside the REST route function directly,
      you'd have to duplicate it (or awkwardly reach across modules) once
      gRPC arrives in Phase 2. Putting it here means the future gRPC
      handler will simply import and call this exact function, with zero
      duplication.

WHO CALLS THIS: api/routes.py today (Phase 1). grpc/handlers.py will call
      it too, starting Phase 2.

DATA IN: plain Python primitives (str, str) — deliberately NOT a Pydantic
      model. This function has zero knowledge of REST or gRPC; it just
      takes plain values in and returns plain values out. Keeping this
      layer protocol-agnostic is exactly what makes it reusable across
      both REST and gRPC.
DATA OUT: a plain dict shaped like the AnalysisResult schema.
"""

from app.models.fake_model import run_fake_inference


async def analyze_text(text: str, analysis_type: str) -> dict:
    # A business-rule check that goes beyond what Pydantic's type system
    # alone already guarantees. Pydantic already enforces analysis_type
    # is one of the three literal strings, and that text is non-empty —
    # this is where you'd add rules Pydantic's schema can't express, like
    # a maximum content length.
    if len(text) > 20000:
        raise ValueError("text exceeds maximum allowed length (20000 chars)")

    # NOTE — worth sitting with: run_fake_inference() is a BLOCKING
    # (synchronous, time.sleep-based) function, and we are calling it
    # here without awaiting anything around it. That means it will block
    # FastAPI's single-threaded event loop for its ENTIRE duration —
    # while one request is "processing", the whole process can't start
    # handling any other request. This is intentional in Phase 1, so you
    # can feel the problem yourself (see the experiment below). A later
    # phase will fix this properly with asyncio, and you'll be able to
    # measure the difference by firing concurrent requests before and
    # after.
    result = run_fake_inference(text, analysis_type)
    return result
