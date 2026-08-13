"""
REQUEST SCHEMAS — fastapi-service/app/schemas/requests.py

WHAT: Pydantic models describing exactly what shape of JSON this service
      accepts on its REST endpoints.

WHY IT EXISTS: this is FastAPI's equivalent of hand-written Express
      request validation — except DECLARATIVE (you describe the shape;
      Pydantic enforces it at runtime) rather than IMPERATIVE (you write
      `if` statements checking req.body fields by hand, the way
      analyze.controller.ts still does on the Express side).

WHO CALLS THIS: FastAPI itself, automatically, before your path operation
      function body ever runs — this is the "Pydantic Validation" stage
      of the FastAPI request lifecycle.

DATA IN: raw JSON bytes off the wire (already decoded from UTF-8 by
      Starlette/ASGI, then handed to Pydantic).
DATA OUT: a validated, typed Python object (an AnalyzeRequest instance).
      Deserialization and validation happen together, in one step — if
      validation fails, your route function is never called at all;
      FastAPI returns an HTTP 422 automatically, with a JSON body
      describing exactly which field failed and why.
"""

from pydantic import BaseModel, Field
from typing import Literal


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Document text to analyze")
    analysis_type: Literal["summary", "sentiment", "keywords"] = Field(
        ..., description="Which kind of analysis to run"
    )
