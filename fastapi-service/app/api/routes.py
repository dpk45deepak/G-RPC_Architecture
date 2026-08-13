"""
REST ROUTES — fastapi-service/app/api/routes.py

WHAT: FastAPI's equivalent of an Express Router — declares HTTP method +
      path -> handler function ("path operation function", in FastAPI's
      own vocabulary) mappings.

WHY IT EXISTS: separates route declarations from app bootstrap (main.py),
      the same instinct as express-service/src/routes/analyze.routes.ts
      being separate from index.ts.

WHO CALLS THIS: included into the app in main.py via
      `app.include_router(...)`.

REQUEST LIFECYCLE THROUGH THIS FILE:
      HTTP request -> Uvicorn (ASGI server) -> Starlette routing -> a path
      operation function in THIS FILE is selected -> FastAPI resolves the
      function's parameters via dependency injection (here: automatically
      parsing + validating the JSON body into an AnalyzeRequest, purely
      because the parameter is type-annotated as `AnalyzeRequest`) -> the
      function body runs -> the return value is serialized against
      `response_model=` -> HTTP response goes back over the wire.

      Notice what's ABSENT compared to Express: no `req.body`, no
      `JSON.parse`, no manual `if (!body.text)` check. Annotating the
      parameter's type is sufficient for FastAPI to know to parse AND
      validate the request body against that exact Pydantic model before
      your code ever runs.
"""

from fastapi import APIRouter, HTTPException
from app.schemas.requests import AnalyzeRequest
from app.schemas.responses import AnalysisResult
from app.services.analysis_service import analyze_text

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "fastapi-ai-service", "phase": 1}


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(payload: AnalyzeRequest):
    # By the time execution reaches this line, `payload` is GUARANTEED to
    # be a valid AnalyzeRequest — FastAPI already ran Pydantic validation
    # before this function was even called. There is no
    # `if not payload.text` check here because Pydantic already enforced
    # `min_length=1` declaratively in the schema itself.
    try:
        result = await analyze_text(payload.text, payload.analysis_type)
    except ValueError as e:
        # FastAPI's way of returning a specific HTTP status + JSON error
        # body — the REST-world equivalent of
        # `res.status(400).json({ error: ... })` in Express.
        raise HTTPException(status_code=400, detail=str(e))

    return result


# NOTE: GET /jobs/{job_id} is intentionally NOT implemented here in
# Phase 1. Job metadata (status, history) lives in Express + MongoDB, not
# in FastAPI — FastAPI is stateless by design in this project. React asks
# Express for job status; Express owns that data and never delegates the
# question to FastAPI. This is the "service boundaries" decision called
# out in the project brief, made concrete.
