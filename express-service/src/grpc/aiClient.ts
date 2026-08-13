/**
 * GRPC CLIENT — express-service/src/grpc/aiClient.ts
 *
 * WHAT: Builds a typed gRPC client ("stub") for FastAPI's AIService, and
 *       exposes a single `analyzeDocumentGrpc()` function with the SAME
 *       input/output shape as Phase 1's `analyzeDocument()` in
 *       clients/fastapiClient.ts.
 *
 * WHY DYNAMIC LOADING (@grpc/proto-loader) INSTEAD OF GENERATED CODE:
 *       On the Python side (fastapi-service), we ran `protoc` ahead of
 *       time to generate ai_service_pb2.py / ai_service_pb2_grpc.py —
 *       static codegen. On the Node side, @grpc/proto-loader does the
 *       equivalent job AT RUNTIME instead: it reads ai_service.proto
 *       directly when this process starts, and builds an equivalent
 *       client object on the fly. Both approaches produce a client that
 *       knows the same RPC methods and message shapes — static codegen
 *       gives you compile-time type checking and a build step; dynamic
 *       loading skips the build step at the cost of weaker TypeScript
 *       types (note the `as any` below). This project uses dynamic
 *       loading because it's simpler to run without adding a codegen
 *       step to `npm run dev` — a real production TS codebase would very
 *       often reach for static codegen (e.g. ts-proto) instead, for the
 *       type safety.
 *
 * WHAT IS A "STUB"?  The `client` object built below is the stub. Calling
 *       `client.Analyze(...)` does NOT run any Python code directly — it:
 *         1. takes your plain JS object
 *         2. serializes it into protobuf binary, using the message
 *            descriptor loaded from ai_service.proto
 *         3. opens (or reuses) an HTTP/2 connection to FastAPI's gRPC
 *            server on :50051
 *         4. sends the binary payload as an HTTP/2 request
 *         5. waits for FastAPI's binary response, deserializes it back
 *            into a plain JS object, and hands it to your callback
 *       The stub is a LOCAL, in-process stand-in for a REMOTE method —
 *       calling it feels like a function call, but every call is
 *       actually crossing a process (and often machine) boundary. This
 *       is the direct answer to "why can't Express just call the Python
 *       function?": it isn't calling anything directly, ever — it's
 *       always talking to this stub, which does real network I/O.
 *
 * WHO CALLS THIS: analyze.service.ts, replacing its previous import of
 *       clients/fastapiClient.ts.
 *
 * DATA IN: { text, analysisType, requestId } — same shape as Phase 1.
 * SERIALIZATION: grpc-js + proto-loader serialize this into protobuf
 *       BINARY (not JSON text) before it ever touches a socket.
 * NETWORK CALL: gRPC over HTTP/2 to FastAPI's gRPC server (:50051) — a
 *       completely different port from FastAPI's REST server (:8000).
 *       Two different servers, two different ports, on purpose.
 * DESERIALIZATION: FastAPI's grpcio deserializes the binary into a
 *       Python AnalyzeRequest object; on the way back, grpc-js
 *       deserializes FastAPI's binary AnalyzeResponse into the JS object
 *       your callback receives.
 * DATA OUT: an AnalysisResult-shaped object — same output contract as
 *       Phase 1's REST client, so analyze.service.ts doesn't need to
 *       change at all.
 */

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import { AnalysisResult } from "../types/job";

const PROTO_PATH = path.join(__dirname, "../../../proto/ai_service.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,   // keep proto's snake_case field names as-is (analysis_type,
                     // not analysisType) — no hidden renaming, unlike Phase 1's
                     // manual translation in fastapiClient.ts
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// `loadPackageDefinition` turns the parsed .proto descriptor into an
// actual JS object you can `new` a client from. The `as any` here is the
// concrete cost of dynamic loading mentioned above — TypeScript cannot
// know this object's shape ahead of time the way it could from generated
// .d.ts files.
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

// This constructs the stub. `aipipelinelab.AIService` mirrors the
// `package aipipelinelab; service AIService { ... }` declaration in the
// .proto file exactly — the package and service names ARE the path to
// the generated client constructor.
const client = new proto.aipipelinelab.AIService(
  process.env.FASTAPI_GRPC_URL ?? "localhost:50051",
  // Plaintext for local development — production would use
  // grpc.credentials.createSsl(...) instead, the gRPC equivalent of
  // terminating HTTPS on a REST server.
  grpc.credentials.createInsecure()
);

interface AnalyzeArgs {
  text: string;
  analysisType: string;
  requestId: string;
}

export function analyzeDocumentGrpc(args: AnalyzeArgs): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    // A DEADLINE, not a timeout option buried in an axios config object —
    // gRPC treats "how long am I willing to wait" as a first-class
    // concept passed on every call. If FastAPI hasn't responded by this
    // wall-clock time, grpc-js aborts the call itself and your callback
    // receives an error with status DEADLINE_EXCEEDED — you don't need
    // to build your own setTimeout race.
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    client.Analyze(
      // This plain JS object is what proto-loader's generated
      // serializer turns into protobuf binary. Field names here must
      // match the .proto exactly (analysis_type, request_id) because we
      // passed `keepCase: true` above.
      { text: args.text, analysis_type: args.analysisType, request_id: args.requestId },
      { deadline },
      (err: grpc.ServiceError | null, response: any) => {
        if (err) return reject(err);
        resolve({
          summary: response.summary,
          sentiment: response.sentiment,
          keywords: response.keywords,
          // proto-loader keeps the proto's snake_case name here too —
          // translated back to camelCase on our side, same as Phase 1
          // did manually for the outgoing request.
          processingTimeMs: response.processing_time_ms,
        });
      }
    );
  });
}
