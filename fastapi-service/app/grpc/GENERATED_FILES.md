# fastapi-service/app/grpc/GENERATED_FILES.md
#
# This directory, once you run the codegen command below, will contain TWO
# files this project does NOT hand-write, and should NOT hand-edit:
#
#   ai_service_pb2.py        <- message classes (AnalyzeRequest, AnalyzeResponse)
#   ai_service_pb2_grpc.py   <- AIServiceStub (client) + AIServiceServicer (server base)
#
# Generate them with:
#
#   python -m grpc_tools.protoc \
#     -I ../../proto \
#     --python_out=. \
#     --grpc_python_out=. \
#     ../../proto/ai_service.proto
#
# (run from inside fastapi-service/app/grpc/)
#
# WHAT'S ACTUALLY INSIDE THEM, so this isn't a black box:
#
# ai_service_pb2.py contains a Python class per `message` in the .proto —
# e.g. `AnalyzeRequest`. Each class has:
#   - one attribute per proto field (request.text, request.analysis_type, ...)
#   - a `.SerializeToString()` method -> turns the object into protobuf's
#     compact BINARY wire format (not JSON, not human-readable)
#   - a `.ParseFromString(bytes)` method -> the reverse: binary -> object
# This is the actual serialization/deserialization machinery mentioned
# throughout this project's comments — it lives here, generated, not
# hand-written by you or me.
#
# ai_service_pb2_grpc.py contains, per `service` in the .proto:
#   - `AIServiceServicer`  -> an abstract base class with one method per
#     rpc (here: `Analyze`). handlers.py subclasses this and fills in the
#     real implementation. If you forget to implement a method, calling it
#     returns UNIMPLEMENTED by default — the base class handles that for you.
#   - `AIServiceStub`      -> the CLIENT-side class used to call a remote
#     AIService server. FastAPI's server code doesn't use this — Express
#     would, if it used Python-generated code, but Express uses
#     @grpc/proto-loader instead (see aiClient.ts) to get an equivalent
#     stub dynamically, without a Python-only codegen step.
#   - `add_AIServiceServicer_to_server(...)` -> a helper used in server.py
#     to register your handler implementation with a running gRPC server.
#
# These files are regenerated whenever ai_service.proto changes — they are
# NOT meant to be committed by hand-editing; typically they're either
# regenerated at build time or checked in as a build artifact and
# regenerated whenever the .proto changes. This project regenerates them.
