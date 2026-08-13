/**
 * TYPES — express-service/src/types/job.ts
 *
 * WHAT: Shared TypeScript interfaces used across the controller, service,
 *       and client layers.
 *
 * WHY IT EXISTS: keeps the "shape of a job" defined in exactly one place.
 *       Note this is a TypeScript-only construct — it produces NO runtime
 *       validation, unlike the Pydantic models on the FastAPI side (which
 *       validate at runtime, not just compile time). That asymmetry is one
 *       of the bigger mental-model shifts moving from Express to FastAPI:
 *
 *           TypeScript interface -> compile-time only, erased at runtime
 *           Pydantic BaseModel    -> compile-time (via type hints) AND
 *                                     enforced again at runtime, on every request
 *
 * WHO CALLS THIS: imported by controller, service, and client files.
 */

export interface AnalyzeInput {
  text: string;
  analysisType: "summary" | "sentiment" | "keywords";
  priority: "low" | "normal" | "high";
}

export interface AnalysisResult {
  summary: string;
  sentiment: string;
  keywords: string[];
  processingTimeMs: number;
}

export interface Job {
  jobId: string;
  requestId: string;
  status: "processing" | "completed" | "failed";
  analysisType: string;
  priority: string;
  createdAt: string;
  result: AnalysisResult | null;
  durationMs?: number;
  error?: string;
}
