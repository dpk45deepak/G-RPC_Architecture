/**
 * ENTRY POINT — express-service/src/index.ts
 *
 * WHAT: Boots the Express HTTP server. This is the ONLY file that starts
 *       the process — everything else is imported by this file, directly
 *       or indirectly.
 *
 * WHY IT EXISTS: React never talks to FastAPI directly in this project.
 *       Express is the "API Gateway" — the single front door React is
 *       allowed to call. In Phase 1, Express forwards work to FastAPI
 *       over plain REST/HTTP (JSON over HTTP/1.1). Starting Phase 2 we
 *       will replace the REST call *to FastAPI* with a gRPC call — but
 *       React -> Express will stay REST for the entire project. That's
 *       the point of the gateway pattern: the outside world sees one
 *       stable contract while the inside is free to change.
 *
 * WHO CALLS THIS: nothing — it's the process root. You run it directly
 *       (`npm run dev`).
 *
 * PROTOCOL AT THIS LAYER: HTTP/1.1 via Express. No gRPC exists yet in
 *       Phase 1 — it arrives in Phase 2.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import analyzeRouter from "./routes/analyze.routes";

dotenv.config();

const app = express();

// express.json() turns the raw HTTP request body (a stream of bytes) into
// a parsed JS object available at req.body. This IS a deserialization
// step — just not a gRPC/protobuf one. Under the hood it's JSON.parse().
app.use(express.json());
app.use(cors());

// Every route under /api is defined in analyze.routes.ts, not here.
// index.ts should only ever wire things together, never contain
// business logic itself.
app.use("/api", analyzeRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "express-gateway", phase: 1 });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`[express-gateway] listening on http://localhost:${PORT}`);
  console.log(`[express-gateway] Phase 1: forwarding /api/analyze to FastAPI via REST`);
});
