/**
 * RAG Interface — Eagle Insight AI Layer
 *
 * Retrieval-Augmented Generation foundations.
 * Scaffold for future maintenance manual and technical order retrieval.
 *
 * Current status: SCAFFOLD — no embedding/vector store wired.
 * Future implementation: index T.O. documents, retrieve relevant chunks
 * to ground AI explanations.
 */

// ---------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------

export interface RagDocument {
  id: string;
  title: string;
  sourceRef: string;      // e.g., "T.O. 1F-16A-2-70JG-00-1"
  docType: 'manual' | 'procedure' | 'bulletin' | 'directive' | 'other';
  indexedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceRef: string;
  chunkIndex: number;
  content: string;
  metadata: {
    section?: string;       // e.g., "§2.3.1"
    system?: string;        // e.g., "hydraulics"
    parameter?: string;     // e.g., "hydraulic_pressure_psi"
    keywords?: string[];
  };
}

// ---------------------------------------------------------------------------
// Retrieval request / response
// ---------------------------------------------------------------------------

export interface RetrievalQuery {
  query: string;                // Free-text or structured query
  filters?: {
    docType?: string[];
    system?: string;
    parameter?: string;
  };
  topK?: number;                // How many chunks to retrieve (default: 5)
}

export interface RetrievalResult {
  chunks: ScoredChunk[];
  queryId: string;
  latencyMs?: number;
}

export interface ScoredChunk extends DocumentChunk {
  relevanceScore: number;       // 0–1
  citation: string;             // Ready-to-display citation string
}

// ---------------------------------------------------------------------------
// Retrieval service interface
// ---------------------------------------------------------------------------

export interface RetrievalService {
  /**
   * Retrieve relevant document chunks for a query.
   */
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;

  /**
   * Index a new document (splits into chunks, embeds, stores).
   */
  indexDocument(doc: RagDocument, content: string): Promise<void>;

  /**
   * Check if the service is available.
   */
  isAvailable(): boolean;

  /**
   * Get indexed document count.
   */
  getDocumentCount(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Null implementation (safe fallback when RAG is not yet configured)
// ---------------------------------------------------------------------------

export class NullRetrievalService implements RetrievalService {
  retrieve(_query: RetrievalQuery): Promise<RetrievalResult> {
    console.info('[RAG] Retrieval service not configured. Returning empty results.');
    return Promise.resolve({
      chunks: [],
      queryId: `null-${Date.now()}`,
    });
  }

  indexDocument(_doc: RagDocument, _content: string): Promise<void> {
    console.warn('[RAG] Cannot index document — retrieval service not configured.');
    return Promise.resolve();
  }

  isAvailable(): boolean {
    return false;
  }

  getDocumentCount(): Promise<number> {
    return Promise.resolve(0);
  }
}

// Global singleton (replace with real implementation when ready)
let _retrievalService: RetrievalService = new NullRetrievalService();

export const retrievalRegistry = {
  register(service: RetrievalService): void {
    _retrievalService = service;
    console.log('[RAG] Retrieval service registered');
  },
  get(): RetrievalService {
    return _retrievalService;
  },
  isAvailable(): boolean {
    return _retrievalService.isAvailable();
  },
};

// ---------------------------------------------------------------------------
// Citation formatter
// ---------------------------------------------------------------------------

export function formatCitation(chunk: DocumentChunk): string {
  const parts = [chunk.sourceRef];
  if (chunk.metadata.section) parts.push(chunk.metadata.section);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Rule-to-query helper
// Converts a rule violation into a retrieval query for relevant T.O. sections
// ---------------------------------------------------------------------------

export function ruleViolationToQuery(violation: {
  ruleId: string;
  parameter: string;
  referenceDoc?: string;
  clause?: string;
}): RetrievalQuery {
  const parts = [`parameter: ${violation.parameter}`];
  if (violation.referenceDoc) parts.push(`document: ${violation.referenceDoc}`);
  if (violation.clause)       parts.push(`section: ${violation.clause}`);

  return {
    query: parts.join(', '),
    filters: {
      parameter: violation.parameter,
    },
    topK: 3,
  };
}
