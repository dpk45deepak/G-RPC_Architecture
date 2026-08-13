/**
 * SERVICE LAYER — express-service/src/services/analyze.service.ts
 *
 * WHAT: Owns the business logic of "submit a document for analysis":
 *   1. generate a job id + request id
 *   2. store job metadata (in-memory for Phase 1 — MongoDB arrives later)
 *   3. call the AI backend (FastAPI) to get a real answer
 *   4. update the stored job with the result
 *   5. return the finished job to the controller
 *
 * WHY IT EXISTS: this is the layer that changes the LEAST across all 8
 *       phases. Phase 2 replaces step 3's *implementation* (REST call ->
 *       gRPC call) but the shape of this function — "build a job, ask the
 *       AI service, record the result" — stays the same. That stability
 *       is exactly why business logic belongs here and not in the
 *       controller (HTTP-shaped) or the client (transport-shaped).
 *
 *           HTTP Controller -> Service Layer -> Transport Client -> FastAPI
 *
 * WHO CALLS THIS: analyze.controller.ts only. Nothing else should.
 *
 * DATA IN: a plain TS object { text, analysisType, priority }.
 * DATA OUT: a Job object with status + result populated.
 *
 * NOTE ON STORAGE: real job storage (MongoDB) is intentionally deferred
 *       to a later phase. An in-memory Map is enough to prove the
 *       architecture end-to-end without adding another moving part
 *       before you've seen the REST call itself work.
 */

import { v4 as uuidv4 } from "uuid";
// PHASE 2 CHANGE — this is the ENTIRE diff this file needed for the
// REST -> gRPC swap: one import, pointing at grpc/aiClient.ts instead of
// clients/fastapiClient.ts. Both modules export a function with the same
// input/output shape, so nothing else below changes. This is exactly the
// payoff promised in Phase 1's comments — the seam did its job.
import { analyzeDocumentGrpc as analyzeDocument } from "../grpc/aiClient";
import { Job, AnalyzeInput } from "../types/job";

// In-memory "database". Replaced by MongoDB in a later phase. This is
// intentionally the simplest possible thing that works: a Map keyed by
// jobId, living in this process's memory (gone on restart).
const jobs = new Map<string, Job>();

export async function submitAnalysis(input: AnalyzeInput): Promise<Job> {
  const jobId = `job_${uuidv4().slice(0, 8)}`;
  const requestId = `req_${uuidv4().slice(0, 8)}`;

  const job: Job = {
    jobId,
    requestId,
    status: "processing",
    analysisType: input.analysisType,
    priority: input.priority,
    createdAt: new Date().toISOString(),
    result: null,
  };
  jobs.set(jobId, job);

  console.log(`[${requestId}] job ${jobId} created -> calling FastAPI over gRPC`);

  const start = Date.now();
  try {
    // This is the ONLY line in this file that knows anything about the
    // AI backend's transport — everything about "how do I actually reach
    // FastAPI" is hidden inside aiClient.ts. That's the whole point of
    // giving the transport client its own module: this function body is
    // byte-for-byte identical to Phase 1's, only the import above changed.
    const result = await analyzeDocument({
      text: input.text,
      analysisType: input.analysisType,
      requestId,
    });

    const duration = Date.now() - start;
    console.log(`[${requestId}] FastAPI (gRPC) responded in ${duration}ms`);

    job.status = "completed";
    job.result = result;
    job.durationMs = duration;
  } catch (err: any) {
    job.status = "failed";
    job.error = err.message;
    console.error(`[${requestId}] FastAPI call failed: ${err.message}`);
    throw err; // let the controller decide the HTTP status code
  }

  return job;
}

export function getJobById(jobId: string): Job | undefined {
  return jobs.get(jobId);
}
