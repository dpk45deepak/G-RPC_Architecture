"""
APP BOOTSTRAP — fastapi-service/app/main.py

WHAT: Creates the FastAPI application instance and wires in the REST
      router. This is the file Uvicorn runs (`uvicorn app.main:app`).

WHY IT EXISTS: FastAPI is, at its core, a Python class (`FastAPI`) that an
      ASGI server like Uvicorn knows how to run. This file is where that
      class gets instantiated — nothing about protobuf, gRPC, or grpcio
      belongs here, and that distinction is worth stating outright:

          FastAPI -> handles HTTP/REST only. It has no built-in concept
                     of gRPC whatsoever.
          grpcio  -> a completely separate Python library that will run
                     its OWN server (grpc/server.py, added in Phase 2),
                     in the SAME process, on a DIFFERENT port (50051).

      FastAPI does not gain gRPC powers by being used in this project.
      Starting Phase 2 we will run two independent servers side by side —
      Uvicorn serving REST on :8000, and grpcio's own server serving gRPC
      on :50051 — both importing the SAME service layer
      (services/analysis_service.py) so business logic is never
      duplicated between the two protocols.

WHO CALLS THIS: Uvicorn, when you run `uvicorn app.main:app --reload`.
"""

from fastapi import FastAPI
from app.api.routes import router as api_router

app = FastAPI(
    title="AI Pipeline Lab — FastAPI AI Service",
    description="Phase 1: REST-only. gRPC (and a second, parallel server) arrives in Phase 2.",
    version="0.1.0",
)

# Every request matching a path in api_router flows: Uvicorn -> ASGI ->
# FastAPI middleware (none custom yet) -> routing -> dependency injection
# -> the matched path operation function -> response serialization. See
# api/routes.py for the per-route breakdown of this lifecycle.
app.include_router(api_router)
