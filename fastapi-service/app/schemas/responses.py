"""
RESPONSE SCHEMAS — fastapi-service/app/schemas/responses.py

WHAT: Pydantic models describing exactly what shape of JSON this service
      sends back.

WHY IT EXISTS: FastAPI uses this not only for serialization but also to
      auto-generate OpenAPI docs at /docs. Declaring `response_model=` on
      a route (see api/routes.py) makes FastAPI FILTER the returned
      object down to only these fields, even if the Python value passed
      back has extra keys — a safety net against accidentally leaking
      internal fields in a response, with no equivalent mechanism in a
      typical Express + `res.json()` setup.

WHO CALLS THIS: FastAPI, after your path operation function returns,
      during the "Response Serialization" stage of the request lifecycle.
"""

from pydantic import BaseModel


class AnalysisResult(BaseModel):
    summary: str
    sentiment: str
    keywords: list[str]
    processing_time_ms: int
