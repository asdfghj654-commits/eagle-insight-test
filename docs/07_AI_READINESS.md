# Document 7: AI Readiness and Fine-Tuning Readiness Specification

**Date:** 2026-04-05

---

## 1. Current AI Status

The system currently has:
- `src/lib/ai/provider-interface.ts` — interface stub
- `src/lib/ai/rag-interface.ts` — RAG interface stub
- `src/lib/ai/fine-tuning.ts` — fine-tuning type definitions
- `ai_trace_log` table in SQLite — already prepared for tracing AI interactions
- `AIPredictions` component — correctly showing "not available"
- `export_ready` flag in ai_trace_log — prepared for training data export

**Conclusion:** The scaffolding is in place. The design is correct. AI is not fabricated. The next step is to deepen this scaffolding without activating any AI behavior that is not real.

---

## 2. AI Boundary Definition

### What AI should do (when integrated)

| Capability | Description |
|---|---|
| Explanation | Given a finding + evidence, explain in plain language what happened |
| Summarization | Given a dossier with multiple findings, summarize for different roles |
| Document-grounded help | Answer "what does the manual say about this finding?" with citations |
| Investigation support | Suggest which parameters to look at next given current evidence |
| Recommendation formatting | Structure a human-authored recommendation into standard format |
| Retrieval assistance | Find relevant past cases or similar findings from history |

### What AI must NOT do (ever)

| Prohibited action | Reason |
|---|---|
| Make autonomous airworthiness decisions | Human authority required; liability |
| Override a finding rejection | Human review required |
| Publish a finding without human review | Fabricated findings are dangerous |
| Produce confidence scores without calibration | Fabricated confidence destroys trust |
| Access pilot identity directly | Access control boundary |
| Generate finding text without traceability | No black-box outputs |

---

## 3. AI Architecture Design

### 3.1 AI Gateway Service

A server-side AI gateway — the only entry point for AI capabilities:

```typescript
// local-server/src/services/ai-gateway.ts

interface AiGateway {
  explain(request: ExplainRequest): Promise<AiResponse>;
  summarize(request: SummarizeRequest): Promise<AiResponse>;
  retrieve(request: RetrievalRequest): Promise<AiResponse>;
}

interface ExplainRequest {
  findingId: string;
  contextType: 'technician' | 'engineer' | 'commander';
  maxTokens?: number;
}

interface AiResponse {
  available: boolean;             // false until AI is integrated
  content?: string;
  citations?: Citation[];         // links to evidence or documents used
  modelUsed?: string;
  inputTokens?: number;
  outputTokens?: number;
  traceId?: string;               // links to ai_trace_log
}

interface Citation {
  sourceType: 'document' | 'finding' | 'rule' | 'telemetry';
  sourceId: string;
  excerpt?: string;
  relevanceScore?: number;
}
```

Current behavior of all gateway methods: return `{ available: false }` until a provider is configured.

### 3.2 Provider Abstraction

AI provider is configured via environment variable or source config. The gateway resolves the provider at runtime:

```typescript
type AiProvider = 'none' | 'openai' | 'anthropic' | 'local_ollama' | 'azure_openai';

// Resolved from: process.env.AI_PROVIDER || 'none'
```

When `AI_PROVIDER=none` (default), all AI requests return `{ available: false }` immediately, no network calls.

### 3.3 Prompt Orchestration

Each AI capability has a structured prompt template:

```typescript
interface PromptTemplate {
  id: string;
  capability: string;
  systemPrompt: string;
  inputSchema: JsonSchema;        // Validates what is passed to the AI
  outputSchema: JsonSchema;       // Validates what comes back
  maxContextTokens: number;
  requiredEvidence: string[];     // What evidence fields are required before calling AI
}
```

Prompts are versioned and stored in `prompt_templates` table (future). This ensures:
- Prompt changes are tracked
- Outputs can be traced to specific prompt versions
- Regression testing is possible

### 3.4 Structured Output Schema

All AI outputs must conform to a schema — no free-form text returned directly to the frontend:

```typescript
interface FindingExplanation {
  summary: string;                // 1-3 sentences, role-appropriate
  technicalDetail: string;        // For engineer/specialist
  evidenceBasis: string;          // What data this explanation is based on
  uncertainty: string;            // What is not known / what could not be assessed
  recommendedNextSteps?: string[];
  citations: Citation[];
}
```

The frontend never renders raw AI text directly. It renders structured fields with appropriate labels.

### 3.5 Trace and Logging

Every AI call is logged to `ai_trace_log`:

```typescript
// On every AI gateway call:
await db.prepare(`
  INSERT INTO ai_trace_log 
    (id, trace_type, input_context, retrieved_docs, model_response, 
     related_finding, related_flight, export_ready, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
`).run(
  id, capability, JSON.stringify(input), JSON.stringify(retrievedDocs),
  JSON.stringify(response), findingId, sortieId
);
```

The `export_ready` flag is set to 1 by an engineer when they review and approve the AI output for training dataset export.

---

## 4. RAG (Retrieval-Augmented Generation) Readiness

### 4.1 Document types to prepare for retrieval

| Document type | Format | Source |
|---|---|---|
| Technical Orders (T.O.) | PDF or structured text | Reference docs per rule (already in `reference_doc` field) |
| Maintenance procedures | PDF or structured text | Engineering library |
| Waivers and restrictions | Structured records | Operational database |
| Historical findings | Structured SQLite records | Already in system |
| Dossier summaries | Structured text | Auto-generated from dossiers |
| Rule definitions | Structured SQLite records | Already in system |

### 4.2 Document ingestion pipeline (future)

```
Document added (PDF, text)
  → Document ingestion service
  → Parse and chunk (fixed-size or semantic chunks)
  → Generate embeddings (local model or provider API)
  → Store chunks + embeddings in vector store
  → Store metadata in SQLite: doc_id, title, chunk_id, page, section

On retrieval request:
  → Query text → embedding
  → Vector similarity search → top-K chunks
  → Chunks passed as context to LLM
  → Response returned with citations to source documents
```

### 4.3 Vector store recommendation

For on-prem / local use:
- **SQLite with sqlite-vec extension** — minimal infrastructure, no additional services
- Or: **Chroma** (local, Python-based) — if Python runtime is available
- Or: **pgvector** — if migrating to PostgreSQL

For OpenShift:
- **pgvector** (PostgreSQL extension, deployable as OpenShift workload)
- Or: **Weaviate** as a separate deployment

The RAG interface stub already exists in `src/lib/ai/rag-interface.ts`. The server-side implementation should mirror this contract.

### 4.4 Retrieval contract

```typescript
interface RagRetrieval {
  query: string;
  filters?: {
    documentTypes?: string[];
    ruleIds?: string[];
    aircraftTypes?: string[];
    dateRange?: { from: string; to: string };
  };
  limit: number;
}

interface RagResult {
  chunks: {
    id: string;
    documentId: string;
    documentTitle: string;
    excerpt: string;
    page?: number;
    section?: string;
    relevanceScore: number;
  }[];
}
```

---

## 5. Fine-Tuning Readiness

### 5.1 Training data schema

The `ai_trace_log` table already has fields for this. A dedicated training dataset table should be added:

```sql
CREATE TABLE IF NOT EXISTS training_examples (
  id                    TEXT PRIMARY KEY,
  example_type          TEXT NOT NULL,  -- 'finding_explanation', 'recommendation', 'summarization'
  
  -- Input context
  finding_title         TEXT,
  finding_summary       TEXT,
  telemetry_summary     TEXT,           -- JSON: key stats for relevant parameters
  maintenance_context   TEXT,           -- JSON: aircraft, tail, maintenance history
  relevant_rules        TEXT,           -- JSON: which rules triggered
  retrieved_docs        TEXT,           -- JSON: RAG results used as context
  
  -- Output
  model_response        TEXT,           -- What the AI generated
  human_reviewed        INTEGER DEFAULT 0,
  human_corrected_response TEXT,        -- Corrected version (the ground truth)
  
  -- Labels
  quality_score         REAL,           -- Human rating: 0.0-1.0
  approved_for_training INTEGER DEFAULT 0,
  
  -- Metadata
  reviewer_id           TEXT,
  reviewed_at           TEXT,
  model_version         TEXT,
  prompt_template_id    TEXT,
  
  related_finding       TEXT,
  related_sortie        TEXT,
  
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 5.2 Data capture workflow

```
AI interaction occurs (engineer asks for explanation of a finding)
  → ai_trace_log entry created (always)
  → Engineer reviews AI response
  → If approved: engineer clicks "Mark for training"
    → training_example created with:
        input_context = finding + telemetry summary + retrieved docs
        model_response = AI output
        human_reviewed = 1
  → If corrected: engineer edits AI response
    → human_corrected_response saved
    → quality_score set
  → Export endpoint: GET /api/training-data/export
    → Returns all examples where approved_for_training = 1
    → Format: JSONL (one example per line, Anthropic/OpenAI fine-tuning format)
```

### 5.3 Minimum data quality for fine-tuning

Do not attempt fine-tuning until:
- At least 50 high-quality reviewed examples per task type
- At least 20% of examples include human corrections
- All examples have been reviewed by an engineer with domain knowledge
- Each example has full context: finding + telemetry summary + retrieved documents

### 5.4 What to capture now (before any AI is integrated)

Even without AI, start capturing structured human decisions to use as training data later:

```sql
-- Example: engineer accepts or rejects a finding
-- When status changes from new → acknowledged or new → rejected:
INSERT INTO training_examples (
  example_type, finding_title, finding_summary, 
  relevant_rules, human_reviewed, human_corrected_response,
  quality_score, approved_for_training
)
-- human_corrected_response = the engineer's review note (their reasoning)
-- This becomes: input=finding, expected_output=human_reasoning
```

Human review notes entered today become labeled training data for future explanation models.

---

## 6. Evaluation Readiness

### 6.1 Golden cases

When AI is integrated, maintain a set of "golden cases" — known inputs with known correct outputs:

```sql
CREATE TABLE IF NOT EXISTS ai_golden_cases (
  id                  TEXT PRIMARY KEY,
  example_type        TEXT NOT NULL,
  input_context       TEXT NOT NULL,
  expected_output     TEXT NOT NULL,     -- Authored by domain expert
  created_by          TEXT NOT NULL,
  description         TEXT,
  last_run_at         TEXT,
  last_run_score      REAL,
  last_run_model      TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 6.2 Evaluation endpoint

```
POST /api/ai/evaluate
  body: { goldenCaseId: string, modelConfig?: object }
  response: { 
    score: number,
    expectedOutput: string,
    actualOutput: string,
    diff: string,
    passedAt: string
  }
```

Run before deploying any model update.

### 6.3 Regression testing

Before any model version change:
1. Run all golden cases
2. Compare score to baseline (previous model version)
3. If any golden case score drops > 10% → block deployment
4. Human review required before releasing model update
