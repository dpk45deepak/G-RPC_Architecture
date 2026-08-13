# AI Pipeline Lab

An educational distributed system for learning **Express ↔ gRPC ↔ FastAPI**
communication architecture. The AI is fake on purpose — the thing you're
here to learn is how services talk to each other.

This README grows with every phase. Right now it only documents **Phase 1**.

---

## Phase 1: Express → FastAPI, plain REST

### What we're building

The simplest possible version of the pipeline: no gRPC, no MongoDB, no
Docker, no streaming. Just:

```
React (not built yet — use curl/Postman)
   │  HTTP/JSON
   ▼
Express API Gateway  (:3000)
   │  HTTP/JSON  ← the seam that becomes gRPC in Phase 2
   ▼
FastAPI AI Service   (:8000)
   │  plain Python function call
   ▼
Fake ML Model
```

Every file that will later be touched by gRPC already exists, already
layered correctly, and already has a comment telling you *why* it's
shaped the way it is, so that when Phase 2 replaces one function body,
you'll recognize exactly what changed and what didn't.

### Why build it this way first

You already know Express-calls-a-REST-API. Phase 1 deliberately gives you
nothing new on the transport side — the only genuinely new thing is
**FastAPI's request lifecycle**, which is different enough from Express's
that it deserves your full attention before gRPC gets added on top.

### MERN developer's mental model (Phase 1 slice)

| Express (what you know)                 | FastAPI (what's new)                                      |
|-------------------------------------------|-------------------------------------------------------------|
| `express.json()` middleware               | Built into Starlette (ASGI), always on                     |
| Manual `if (!req.body.text)` checks       | Pydantic `BaseModel` — declared once, enforced on every request automatically |
| `req.body.text`                           | A typed function parameter (`payload: AnalyzeRequest`)      |
| `res.status(400).json({...})`             | `raise HTTPException(status_code=400, detail=...)`          |
| No automatic response shape enforcement   | `response_model=` filters/validates what you return         |
| Router (`express.Router()`)               | `APIRouter()`                                                |
| No built-in docs                          | Auto-generated interactive docs at `/docs`                  |

The important shift: in Express, validation is something *you write*. In
FastAPI, validation is something you *declare* (as a Pydantic model), and
the framework enforces it before your function body ever runs.

### Folder structure (Phase 1)

```
ai-pipeline-lab/
├── express-service/
│   ├── src/
│   │   ├── index.ts                    # process entry point
│   │   ├── routes/analyze.routes.ts    # URL → controller mapping
│   │   ├── controllers/analyze.controller.ts  # HTTP-only layer
│   │   ├── services/analyze.service.ts # business logic (stable across phases)
│   │   ├── clients/fastapiClient.ts    # ← the seam that becomes gRPC in Phase 2
│   │   └── types/job.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── fastapi-service/
    ├── app/
    │   ├── main.py                     # process entry point
    │   ├── api/routes.py               # REST routes
    │   ├── schemas/requests.py         # Pydantic input validation
    │   ├── schemas/responses.py        # Pydantic output shape
    │   ├── services/analysis_service.py# business logic (shared with gRPC later)
    │   └── models/fake_model.py        # deterministic fake "ML"
    ├── requirements.txt
    └── .env.example
```

Notice the Express and FastAPI folder structures mirror each other:
`routes → controller/route → service → client/model`. That's not an
accident — it's the same layering discipline applied in both languages.

### FastAPI request lifecycle, traced through this exact code

```
HTTP POST /analyze
   │
   ▼
Uvicorn (ASGI server)         — accepts the raw TCP/HTTP connection
   │
   ▼
Starlette routing             — matches "POST /analyze" to routes.py's `analyze()`
   │
   ▼
Dependency injection          — sees `payload: AnalyzeRequest` and knows to
   │                             build one from the request body
   ▼
Pydantic validation           — schemas/requests.py's AnalyzeRequest checks
   │                             `text` is non-empty and `analysis_type` is
   │                             one of the three allowed literals. On
   │                             failure: HTTP 422, your code never runs.
   ▼
Path operation function runs  — api/routes.py's `analyze()` body executes
   │
   ▼
Service layer                 — services/analysis_service.py's analyze_text()
   │
   ▼
Fake model                    — models/fake_model.py's run_fake_inference()
   │
   ▼
Response serialization        — schemas/responses.py's AnalysisResult
   │                             filters/validates the returned dict
   ▼
HTTP response
```

### Where serialization/deserialization actually happens (Phase 1)

| Step | Direction | Mechanism |
|---|---|---|
| Express builds request body | JS object → JSON bytes | `axios` calls `JSON.stringify()` internally |
| FastAPI receives request body | JSON bytes → Python object | Starlette decodes UTF-8, Pydantic parses + validates into `AnalyzeRequest` |
| FastAPI builds response body | dict → JSON bytes | Pydantic's `response_model` serializer, then `JSON.dumps`-equivalent |
| Express receives response | JSON bytes → JS object | `axios` calls `JSON.parse()` internally |

This is plain JSON/REST serialization. Phase 3 will replace this whole
row with **binary protobuf serialization**, and having this REST version
clearly in view first will make that comparison land.

---

## Running Phase 1

**Terminal 1 — FastAPI:**
```bash
cd fastapi-service
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Express:**
```bash
cd express-service
npm install
cp .env.example .env
npm run dev
```

You should see:
```
[express-gateway] listening on http://localhost:3000
[express-gateway] Phase 1: forwarding /api/analyze to FastAPI via REST
```

---

## Experiment 1: watch a request cross the boundary

With both services running:

```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Artificial intelligence is transforming great software teams", "analysisType": "summary", "priority": "high"}' | python3 -m json.tool
```

Then, using the `jobId` from the response:

```bash
curl -s http://localhost:3000/api/jobs/<jobId> | python3 -m json.tool
```

Also try FastAPI's interactive docs directly, bypassing Express entirely:
`http://localhost:8000/docs` → try `POST /analyze` from the browser.

### What to observe

1. In the Express terminal, you'll see two log lines per request: job
   creation, then the FastAPI response time. Note the `requestId` —
   it's the same value both times.
2. In the FastAPI terminal (with `--reload`, Uvicorn logs each request),
   you'll see the incoming `POST /analyze` logged separately.
3. Time roughly how long the whole `curl` takes vs. the
   `processingTimeMs`/`durationMs` fields in the response — the
   difference is network + Express overhead, not model time.
4. Send a request with `"analysisType": "not-a-real-type"` and see it
   rejected by **Express's** hand-written check (400, from
   `analyze.controller.ts`) before FastAPI is ever called.
5. Send a request directly to FastAPI's `/analyze` (port 8000, bypassing
   Express) with a bad `analysis_type` and compare the error shape —
   this one comes from **Pydantic**, not from any code you wrote.
6. Open two terminals and fire two `curl` requests to FastAPI at nearly
   the same time. Notice the second one doesn't start processing until
   the first one's `time.sleep()` finishes — this is the blocking-call
   problem flagged in `analysis_service.py`'s comments. Keep this
   observation; a later phase fixes it and you'll be able to prove the
   fix worked by repeating this exact test.

---

## Check your understanding

1. Why does `analyze.controller.ts` re-validate `analysisType` when
   FastAPI is going to validate it again anyway with Pydantic? What
   would happen if Express trusted the client completely and skipped
   its own check?
2. `fastapiClient.ts` sends `analysis_type` (snake_case) instead of
   `analysisType` (camelCase). Why does that translation have to happen
   somewhere, and why is `fastapiClient.ts` the right place for it
   rather than, say, `analyze.service.ts`?
3. In FastAPI's `routes.py`, there's no line that looks like
   `if not payload.text`. Where did that check actually happen, and at
   what point in the request lifecycle?
4. `analysis_service.py` calls `run_fake_inference()` — a *synchronous*,
   *blocking* function — from inside an `async def`. What did you
   observe in the two-concurrent-requests experiment, and why did it
   happen? (You don't need to know the fix yet — just be able to
   describe the symptom.)
5. If `analyze.service.ts` currently only knows "call `analyzeDocument()`
   and get an `AnalysisResult` back", what does that tell you about how
   much of this file Phase 2 (switching to gRPC) will actually need to
   change?

---

## What's next

Phase 2 replaces the body of `fastapiClient.ts`'s `analyzeDocument()`
function with a gRPC client stub call instead of an `axios.post()` —
and adds a parallel gRPC server inside the FastAPI service, running
alongside Uvicorn, both calling the same `analysis_service.py`. Nothing
in `analyze.controller.ts` or `analyze.service.ts` will change.
