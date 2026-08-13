/**
 * ROUTES — express-service/src/routes/analyze.routes.ts
 *
 * WHAT: Declares the URL + HTTP method -> controller function mapping for
 *       the /api/analyze* endpoints.
 *
 * WHY IT EXISTS: separates "which URL/method triggers what" from "what
 *       that code actually does" (the controller). Nothing new here vs
 *       an Express Router you'd already write in a MERN app.
 *
 * WHO CALLS THIS: mounted by index.ts under the `/api` prefix.
 *
 * DATA IN: raw Express Request objects (HTTP).
 * DATA OUT: delegates entirely to controller functions; sends no response
 *       itself.
 */

import { Router } from "express";
import { postAnalyze, getJob } from "../controllers/analyze.controller";

const router = Router();

// POST /api/analyze — submit a document for analysis.
// Phase 1: this ends up calling FastAPI's REST /analyze endpoint.
// Phase 2+: this will end up calling FastAPI's gRPC Analyze RPC instead —
// this line will not change when that happens.
router.post("/analyze", postAnalyze);

// GET /api/jobs/:jobId — check status/result of a previously submitted job.
// Served entirely from Express's own in-memory store (later: MongoDB).
// FastAPI is never involved in answering this request.
router.get("/jobs/:jobId", getJob);

export default router;
