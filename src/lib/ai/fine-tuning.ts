/**
 * Fine-Tuning Dataset Structures — Eagle Insight AI Layer
 *
 * Designed to collect supervised training examples as the system is used.
 * Engineers review AI suggestions; corrections become training data.
 *
 * Each "example" captures the full context needed for a model to learn:
 * - what input the system saw
 * - what the rule engine decided
 * - what the human expert reviewed / corrected
 * - what the final decision was
 *
 * These are exported via the backend AI trace log.
 * Future use: fine-tune a domain-specific model on accumulated examples.
 */

// ---------------------------------------------------------------------------
// Training example (supervised)
// ---------------------------------------------------------------------------

/**
 * A complete training example for maintenance intelligence.
 * Each field represents one view of the event — from raw data to human review.
 */
export interface MaintenanceTrainingExample {
  id: string;
  createdAt: string;

  // --- Input context ---
  input: {
    flightId: string;
    tailNumber: string;
    flightDate?: string;
    telemetrySummary: ParameterSummary[];
    maintenanceHistory?: MaintenanceHistoryEntry[];
  };

  // --- Rule engine output ---
  ruleOutput: {
    violations: RuleViolationSummary[];
    findingIds: string[];
  };

  // --- Retrieved documentation (if RAG was used) ---
  retrievedDocs?: Array<{
    citation: string;
    excerpt: string;
  }>;

  // --- AI-generated content (if model was invoked) ---
  modelOutput?: {
    modelId: string;
    explanation: string;
    suggestedAction?: string;
    confidence?: number;
  };

  // --- Human review ---
  humanReview?: {
    reviewedBy: string;
    reviewedAt: string;
    approved: boolean;
    correction?: string;           // What the human corrected (if anything)
    finalExplanation?: string;     // The accepted final explanation
    finalAction?: string;          // The accepted final action
    qualityScore?: number;         // 1-5
    notes?: string;
  };

  // --- Final decision (ground truth) ---
  groundTruth?: {
    findingStatuses: Record<string, string>;  // findingId → final status
    escalated: boolean;
    escalationReason?: string;
    resolved: boolean;
    resolutionAction?: string;
  };

  // --- Export metadata ---
  exportStatus: 'pending' | 'ready' | 'exported' | 'excluded';
  exclusionReason?: string;
}

export interface ParameterSummary {
  parameter: string;
  unit?: string;
  min: number;
  max: number;
  mean: number;
  stddev?: number;
  phase?: string;
}

export interface MaintenanceHistoryEntry {
  date: string;
  system: string;
  action: string;
  performedBy?: string;
}

export interface RuleViolationSummary {
  ruleId: string;
  parameter: string;
  threshold: number | [number, number];
  actualValue: number;
  unit?: string;
  severity: string;
  phase?: string;
}

// ---------------------------------------------------------------------------
// Eval benchmark case
// ---------------------------------------------------------------------------

/**
 * A golden test case for regression evaluation.
 * Used to check if the system produces the same finding/severity/recommendation
 * after code changes.
 */
export interface EvalBenchmarkCase {
  id: string;
  description: string;
  input: MaintenanceTrainingExample['input'];
  expectedFindings: Array<{
    ruleId: string;
    severity: string;
    status: string;
  }>;
  expectedFleetStatus?: 'ready' | 'degraded' | 'grounded';
  tags: string[];
  createdAt: string;
  lastRunAt?: string;
  lastRunPassed?: boolean;
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/**
 * Format a training example for export as JSONL (one record per line).
 * Suitable for fine-tuning with chat-based models.
 */
export function exampleToFineTuneRecord(example: MaintenanceTrainingExample): string {
  if (!example.humanReview?.approved || !example.humanReview.finalExplanation) {
    throw new Error('Example must have approved human review before export');
  }

  const contextParts: string[] = [];

  // Build system context
  contextParts.push(`Aircraft: ${example.input.tailNumber}`);
  if (example.input.flightDate) contextParts.push(`Flight date: ${example.input.flightDate}`);

  contextParts.push('\nRule violations detected:');
  for (const v of example.ruleOutput.violations) {
    contextParts.push(
      `- ${v.ruleId}: ${v.parameter} = ${v.actualValue}${v.unit || ''} (threshold: ${JSON.stringify(v.threshold)}, severity: ${v.severity})`
    );
  }

  if (example.retrievedDocs?.length) {
    contextParts.push('\nRelevant technical documentation:');
    for (const doc of example.retrievedDocs) {
      contextParts.push(`[${doc.citation}] ${doc.excerpt}`);
    }
  }

  const record = {
    messages: [
      {
        role: 'system',
        content: 'You are an aircraft maintenance intelligence assistant. Explain maintenance findings clearly and concisely, grounded only in the data provided.',
      },
      {
        role: 'user',
        content: contextParts.join('\n'),
      },
      {
        role: 'assistant',
        content: example.humanReview.finalExplanation,
      },
    ],
  };

  return JSON.stringify(record);
}

/**
 * Check whether an example is ready for export.
 */
export function isExportReady(example: MaintenanceTrainingExample): boolean {
  return (
    example.exportStatus === 'ready' &&
    !!example.humanReview?.approved &&
    !!example.humanReview.finalExplanation &&
    example.ruleOutput.violations.length > 0
  );
}

// ---------------------------------------------------------------------------
// Client-side trace logger (sends to backend /api/ai/trace)
// Used to record every AI call for later human review and dataset export.
// ---------------------------------------------------------------------------

export interface AITraceParams {
  traceType: 'inference' | 'retrieval' | 'explanation' | 'export_candidate' | 'eval';
  inputContext?: unknown;
  retrievedDocs?: unknown;
  modelResponse?: unknown;
  relatedFinding?: string;
  relatedFlight?: string;
}

export async function logAITrace(params: AITraceParams): Promise<void> {
  try {
    const token = sessionStorage.getItem('eagle_insight_token');
    await fetch('/api/ai/trace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-critical — don't break the UI if trace logging fails
    console.warn('[AI] Failed to log AI trace');
  }
}
