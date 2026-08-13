"""
GRPC SERVER — fastapi-service/app/grpc/server.py

WHAT: Starts a standalone gRPC server (from the `grpcio` library) that
      listens on its own port (50051) and dispatches incoming RPCs to
      `AIServiceHandler`.

WHY IT EXISTS AS A SEPARATE PROCESS FROM main.py: this is the file that
      makes the earlier claim concrete — "FastAPI does not gain gRPC
      powers; grpcio runs its own, completely separate server". Uvicorn
      (serving REST, via main.py) and this gRPC server are two
      independent event loops, on two independent ports, started by two
      independent commands. They happen to live in the same codebase and
      both import services/analysis_service.py, but neither one knows the
      other exists at the network level.

      This is a real, common production pattern: one Python service
      exposing both a REST API (for browsers/external clients) and a gRPC
      API (for internal service-to-service calls), without either
      protocol wrapping or depending on the other.

WHO CALLS THIS: you, directly — `python -m app.grpc.server` — in its own
      terminal, alongside (not instead of) `uvicorn app.main:app`.

PROTOCOL: gRPC over HTTP/2, plaintext (insecure credentials) for local
      development. Production deployments would use TLS credentials
      instead of `add_insecure_port`.
"""

import asyncio
import grpc
from app.grpc import ai_service_pb2_grpc
from app.grpc.handlers import AIServiceHandler
from app.core.config import settings


async def serve():
    # grpc.aio is grpcio's asyncio-native server — it integrates with
    # Python's asyncio event loop the same way FastAPI/Uvicorn does,
    # which is why `handlers.py`'s `Analyze` method above is declared
    # `async def` and can `await analyze_text(...)` directly.
    server = grpc.aio.server()

    # This registers our handler implementation against the generated
    # servicer interface — grpcio now knows "when an Analyze RPC arrives,
    # call AIServiceHandler().Analyze(...)".
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(AIServiceHandler(), server)

    server.add_insecure_port(f"0.0.0.0:{settings.grpc_port}")
    print(f"[fastapi-grpc] gRPC server listening on :{settings.grpc_port}")

    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
