/**
 * TRANSPORT CLIENT — express-service/src/clients/fastapiClient.ts
 *
 * WHAT: The ONLY file in the Express codebase that knows FastAPI's REST
 *       contract exists — its base URL, its JSON field names, its status
 *       codes. No other file should import axios or know FastAPI's URL.
 *
 * WHY IT EXISTS AS ITS OWN FILE: this is the exact seam where Phase 2 will
 *       do surgery. Right now this function does `axios.post(...)`. In
 *       Phase 2 we will replace the BODY of this function with a call
 *       through a generated gRPC client stub instead — but
 *       analyze.service.ts, which calls this function, will not change
 *       AT ALL, because the function's signature (input in, result out)
 *       stays identical. This is the concrete answer to "why doesn't
 *       Express just call the Python function directly?": Express and
 *       FastAPI are separate OS processes — usually separate containers
 *       or machines. There is no shared memory and no shared function
 *       table between a Node.js process and a Python process. The only
 *       way to cross that boundary is over the network, using a protocol
 *       both sides agree on. Here that protocol is HTTP + JSON. Starting
 *       Phase 2 it will be gRPC + Protocol Buffers instead — a different
 *       protocol, same fundamental problem: cross a process boundary.
 *
 * WHO CALLS THIS: analyze.service.ts only.
 *
 * DATA IN: { text, analysisType, requestId } — a plain JS object living in
 *          V8's heap, nothing serialized yet.
 * SERIALIZATION: axios internally calls JSON.stringify() on the request
 *          body before writing it to the socket — turning the JS object
 *          into a UTF-8 JSON string of bytes on the wire. This is
 *          REST/JSON serialization, distinct from the binary protobuf
 *          serialization Phase 3 will introduce.
 * NETWORK CALL: plain HTTP/1.1 POST to FastAPI's /analyze REST endpoint.
 * DESERIALIZATION: on FastAPI's side, Pydantic parses the JSON body into
 *          a Python object (see fastapi-service/app/schemas/requests.py).
 *          On the way back, axios parses FastAPI's JSON response body
 *          back into a JS object here.
 * DATA OUT: an AnalysisResult object, already deserialized.
 */

import axios from "axios";
import { AnalysisResult } from "../types/job";

const FASTAPI_BASE_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

interface AnalyzeDocumentArgs {
  text: string;
  analysisType: string;
  requestId: string;
}

export async function analyzeDocument(args: AnalyzeDocumentArgs): Promise<AnalysisResult> {
  const { text, analysisType, requestId } = args;

  // In Phase 1, tracing/identity information travels as an HTTP header,
  // because that's the only mechanism plain REST/HTTP gives us for data
  // that isn't part of the JSON body itself. Once gRPC arrives in
  // Phase 2, this exact same requestId will travel as gRPC *metadata*
  // instead of an HTTP header — same underlying idea (out-of-band data
  // attached to a call), different transport-level mechanism. Seeing it
  // here first, as a plain header, will make gRPC metadata easier to
  // recognize as "the same concept, new vocabulary" later.
  const response = await axios.post(
    `${FASTAPI_BASE_URL}/analyze`,
    // snake_case here matches the Pydantic model field names on the
    // FastAPI side (analysis_type, not analysisType). This translation
    // is done by hand in Phase 1 — Phase 3's protobuf contract will make
    // the field names part of a shared, generated contract instead.
    { text, analysis_type: analysisType },
    {
      headers: { "X-Request-Id": requestId },
      // A plain HTTP timeout — the REST-world cousin of the gRPC
      // "deadline" concept we'll add explicitly in a later phase.
      timeout: 5000,
    }
  );

  return response.data as AnalysisResult;
}
