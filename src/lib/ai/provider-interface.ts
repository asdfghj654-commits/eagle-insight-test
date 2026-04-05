/**
 * LLM Provider Interface — Eagle Insight AI Layer
 *
 * Clean abstraction over any local or remote model.
 * Currently a scaffold — no model is wired in the MVP.
 * Plug in Gemma/Ollama/OpenAI-compatible endpoints later by
 * implementing ModelProvider and registering it with the registry.
 *
 * DESIGN PRINCIPLE:
 * The AI layer is an explanation/summarization layer.
 * It must NEVER act as an operational authority.
 * It must NEVER approve airworthiness, invent findings, or bypass rule authority.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type ModelBackend =
  | 'ollama'             // Local Ollama (Gemma, Llama, Mistral, etc.)
  | 'gemma-local'        // Direct Gemma runtime
  | 'openai-compatible'  // Any OpenAI-compatible HTTP endpoint
  | 'anthropic'          // Anthropic Claude API
  | 'mock';              // Test/scaffold — returns fixed responses

export interface ModelConfig {
  backend: ModelBackend;
  modelId: string;         // e.g., 'gemma:7b', 'gpt-4o', 'claude-opus-4-6'
  baseUrl?: string;        // For ollama/openai-compatible
  apiKey?: string;         // For remote APIs
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

export interface ModelRequest {
  systemPrompt?: string;
  messages: ChatMessage[];
  structuredOutputSchema?: Record<string, unknown>; // JSON schema for structured output
  traceId?: string;    // For audit/eval logging
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelResponse {
  content: string;
  structuredOutput?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  modelId: string;
  finishReason: 'stop' | 'length' | 'error';
  traceId?: string;
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Grounding / Evidence contract
// ---------------------------------------------------------------------------

/**
 * Every AI explanation must be grounded.
 * This struct carries the evidence the model is allowed to reference.
 * The model must not invent facts outside this context.
 */
export interface GroundingContext {
  flightId?: string;
  tailNumber?: string;
  ruleViolations?: Array<{
    ruleId: string;
    parameter: string;
    threshold: number | [number, number];
    actualValue: number;
    unit?: string;
  }>;
  telemetrySummary?: Array<{
    parameter: string;
    min: number;
    max: number;
    mean: number;
    unit?: string;
  }>;
  maintenanceHistory?: Array<{
    date: string;
    system: string;
    action: string;
  }>;
  retrievedDocChunks?: RetrievedChunk[];  // from RAG
}

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  content: string;
  relevanceScore?: number;
  citation: string;  // e.g., "T.O. 1F-16A-2-70JG-00-1 §2.3.1"
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ModelProvider {
  readonly backend: ModelBackend;
  readonly config: ModelConfig;

  /**
   * Send a chat request. Returns structured or plain text response.
   */
  complete(req: ModelRequest): Promise<ModelResponse>;

  /**
   * Check if the model is reachable.
   */
  healthCheck(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Result validation hook
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Before using any AI output in the UI, validate it.
 * The AI must not output:
 * - Airworthiness approvals
 * - Invented maintenance facts
 * - Confidence claims without grounding
 * - Safety-critical recommendations that weren't derived from rule authority
 */
export function validateModelResponse(
  response: ModelResponse,
  groundingContext: GroundingContext,
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for hallucinated aircraft identifiers
  if (groundingContext.tailNumber) {
    const content = response.content;
    // Flag any other tail numbers not in context
    const tailPattern = /\b\d{3,4}\b/g;
    const mentioned = content.match(tailPattern) || [];
    for (const t of mentioned) {
      if (t !== groundingContext.tailNumber) {
        warnings.push(`Response mentions tail number ${t} which is not in the grounding context`);
      }
    }
  }

  // Reject any response claiming to approve airworthiness
  const approvalKeywords = ['is airworthy', 'approved for flight', 'cleared for takeoff', 'safe to fly'];
  for (const kw of approvalKeywords) {
    if (response.content.toLowerCase().includes(kw)) {
      issues.push(`Response contains prohibited airworthiness approval language: "${kw}"`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const registry = new Map<string, ModelProvider>();

export const modelRegistry = {
  register(name: string, provider: ModelProvider): void {
    registry.set(name, provider);
    console.log(`[AI] Registered model provider: ${name} (${provider.backend}/${provider.config.modelId})`);
  },

  get(name: string): ModelProvider | undefined {
    return registry.get(name);
  },

  getDefault(): ModelProvider | undefined {
    return registry.get('default') ?? registry.values().next().value;
  },

  isAvailable(): boolean {
    return registry.size > 0;
  },

  list(): string[] {
    return Array.from(registry.keys());
  },
};

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

export const PROMPT_TEMPLATES = {
  /**
   * Explain a finding in plain language.
   * Input: grounding context + finding details.
   * The model should explain what happened and why it matters.
   * Must not make up information not in the grounding.
   */
  FINDING_EXPLANATION: `You are an aircraft maintenance analyst assistant.
You are given a maintenance finding and supporting telemetry data.
Your job is to explain what happened in plain language suitable for a maintenance technician.

Rules:
- Only reference data provided in the context.
- Do not invent facts, parameters, or maintenance history not provided.
- Do not approve or reject airworthiness.
- Do not make safety-critical recommendations beyond what the rule authority already states.
- Be concise (3-5 sentences maximum).
- If you are uncertain, say so explicitly.

Context:
{GROUNDING_CONTEXT}

Finding:
{FINDING_DETAILS}

Provide a clear, factual explanation of what the data shows.`,

  /**
   * Summarize multiple findings for a flight dossier.
   */
  DOSSIER_SUMMARY: `You are an aircraft maintenance intelligence assistant.
Summarize the following maintenance findings for flight {FLIGHT_ID}, aircraft {TAIL_NUMBER}.

Only summarize findings provided. Do not invent additional issues.
Organize by severity (S1 first). Keep it concise.

Findings:
{FINDINGS_LIST}`,

  /**
   * Suggest maintenance actions based on rule violations.
   * Actions must be grounded in the rule reference documents.
   */
  MAINTENANCE_ACTION_SUGGESTION: `You are an aircraft maintenance assistant.
Based on the following rule violation, suggest the next maintenance action.
Ground your suggestion in the referenced Technical Order if provided.

Rule Violation:
{RULE_VIOLATION}

Reference Documentation:
{REFERENCE_DOC}

Suggest the appropriate maintenance action. Cite the Technical Order section.`,
};
