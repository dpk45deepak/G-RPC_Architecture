"""
GRPC HANDLERS — fastapi-service/app/grpc/handlers.py

WHAT: The gRPC-side equivalent of api/routes.py. Implements the actual
      logic behind each RPC declared in ai_service.proto by subclassing
      the generated `AIServiceServicer` base class.

WHY IT EXISTS: notice this file imports `analyze_text` from EXACTLY the
      same place api/routes.py does — services/analysis_service.py. That
      is the single most important fact about this file: REST and gRPC
      are two different front doors into the same business logic. Nothing
      about validation rules, the fake model, or the analysis algorithm
      is duplicated between the two protocols.

WHO CALLS THIS: grpc/server.py registers `AIServiceHandler` with the
      running gRPC server; the gRPC server itself calls `Analyze()` on
      this class whenever a client (Express) makes an Analyze RPC.

DATA IN: an `ai_service_pb2.AnalyzeRequest` — already deserialized from
      protobuf binary into a Python object by grpcio, BEFORE this
      function is even called. You never see raw bytes here, same as
      FastAPI's REST routes never see raw JSON bytes directly.
DATA OUT: an `ai_service_pb2.AnalyzeResponse` — grpcio serializes this
      back into protobuf binary for you on the way out; this function
      only ever touches Python objects.
"""

import grpc
from app.grpc import ai_service_pb2, ai_service_pb2_grpc
from app.services.analysis_service import analyze_text


class AIServiceHandler(ai_service_pb2_grpc.AIServiceServicer):
    async def Analyze(self, request, context):
        # `request.text`, `request.analysis_type`, `request.request_id` —
        # these attribute names come directly from the field names in
        # ai_service.proto, generated into the AnalyzeRequest class.
        print(f"[{request.request_id}] gRPC Analyze received (text len={len(request.text)})")

        try:
            # Identical call to the one api/routes.py makes. This
            # function has no idea whether it was reached via REST or
            # gRPC, and it doesn't need to.
            result = await analyze_text(request.text, request.analysis_type)
        except ValueError as e:
            # This is the gRPC-world equivalent of REST's
            # `raise HTTPException(status_code=400, ...)`. Instead of an
            # HTTP status code, gRPC uses its OWN status code enum
            # (grpc.StatusCode.*) — INVALID_ARGUMENT here maps
            # conceptually to HTTP 400, but nothing performs that mapping
            # automatically. Express's gRPC client will receive this
            # status and has to decide for itself what HTTP status to
            # send React — that mapping is written explicitly in a later
            # phase (see the project's error-handling notes).
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))
            return

        # Building an AnalyzeResponse here is exactly like building a
        # dict for FastAPI's `response_model` in routes.py — except this
        # object, once returned, gets serialized to protobuf BINARY by
        # grpcio, not to a JSON string.
        return ai_service_pb2.AnalyzeResponse(
            summary=result["summary"],
            sentiment=result["sentiment"],
            keywords=result["keywords"],
            processing_time_ms=result["processing_time_ms"],
        )
