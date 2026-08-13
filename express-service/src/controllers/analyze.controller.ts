/**
 * CONTROLLER — express-service/src/controllers/analyze.controller.ts
 *
 * WHAT: The HTTP-facing layer. Its ONLY job is to:
 *   1. read/validate the HTTP request (req.body, req.params)
 *   2. call the service layer to do the actual work
 *   3. translate whatever the service layer returns/throws into an
 *      HTTP status code + JSON body
 *
 * WHY THIS IS ITS OWN FILE, SEPARATE FROM THE SERVICE LAYER: in Phase 2
 *       we will swap what the service layer does internally (REST call ->
 *       gRPC call) WITHOUT touching this file at all. That is the entire
 *       point of layering:
 *
 *           HTTP Controller  ->  Service Layer  ->  (REST today / gRPC later)
 *
 *       If gRPC/transport logic lived directly in this controller, every
 *       transport change would also mean rewriting HTTP-handling code.
 *       Keeping them separate is what makes "swap REST for gRPC in
 *       Phase 2" a small, contained change instead of a rewrite.
 *
 * WHO CALLS THIS: Express, via the router, when a matching HTTP request
 *       arrives.
 *
 * DATA IN: Express Request (HTTP; JSON body already parsed into req.body
 *       by the express.json() middleware registered in index.ts).
 * DATA OUT: Express Response (HTTP status code + JSON body).
 */

import { Request, Response } from "express";
import { submitAnalysis, getJobById } from "../services/analyze.service";

export async function postAnalyze(req: Request, res: Response) {
  const { text, analysisType, priority } = req.body ?? {};

  // Basic HTTP-layer validation. This is NOT the same kind of validation
  // FastAPI/Pydantic will do on the Python side — this check only
  // confirms the JSON shape is sane enough to build a job with. FastAPI
  // will independently re-validate everything it receives. A service
  // should never blindly trust another service's input, even one you
  // also wrote yourself and even when both live in the same repo.
  if (typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "`text` is required and must be a non-empty string" });
  }
  if (!["summary", "sentiment", "keywords"].includes(analysisType)) {
    return res.status(400).json({ error: "`analysisType` must be one of: summary, sentiment, keywords" });
  }

  try {
    const job = await submitAnalysis({
      text,
      analysisType,
      priority: priority ?? "normal",
    });

    // 202 Accepted would be the more "textbook" status for an async job,
    // but Phase 1 waits synchronously for FastAPI's answer before
    // responding at all, so 200 with the completed result is the honest
    // status code for what actually happened here.
    return res.status(200).json(job);
  } catch (err: any) {
    console.error("[analyze.controller] submitAnalysis failed:", err.message);
    // 502 Bad Gateway: Express (acting as a gateway) reached out to an
    // upstream service (FastAPI) and that call failed. This is the
    // correct HTTP semantic for "my upstream dependency broke", distinct
    // from 400 (the caller's fault) or 500 (this service's own bug).
    return res.status(502).json({
      error: "The AI service failed to process this request",
      detail: err.message,
    });
  }
}

export async function getJob(req: Request, res: Response) {
  const job = getJobById(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: `No job found with id ${req.params.jobId}` });
  }
  return res.status(200).json(job);
}
