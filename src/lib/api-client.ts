/**
 * API Client - Eagle Insight Local MVP
 *
 * Centralized HTTP client for all frontend -> backend communication.
 * All operational data flows through this layer.
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'eagle_insight_token';

export const tokenStore = {
  get: (): string | null => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string): void => sessionStorage.setItem(TOKEN_KEY, token),
  clear: (): void => sessionStorage.removeItem(TOKEN_KEY),
};

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  errorHe?: string;
  status: number;
  ok: boolean;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { auth?: boolean } = { auth: true },
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.auth !== false) {
    const token = tokenStore.get();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    let data: T | undefined;
    let error: string | undefined;
    let errorHe: string | undefined;

    try {
      const json = await res.json();
      if (res.ok) {
        data = json as T;
      } else {
        error = json.error;
        errorHe = json.errorHe;
      }
    } catch {
      error = 'Invalid response from server';
    }

    if (res.status === 401) {
      tokenStore.clear();
    }

    return { data, error, errorHe, status: res.status, ok: res.ok };
  } catch {
    return {
      error: 'Network error - is the local server running?',
      errorHe: 'שגיאת רשת - האם השרת המקומי פועל?',
      status: 0,
      ok: false,
    };
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postPublic: <T>(path: string, body?: unknown) => request<T>('POST', path, body, { auth: false }),
};

export const authApi = {
  login: (personalNumber: string, password: string) =>
    apiClient.postPublic<{ token: string; user: AuthUserDto }>('/api/auth/login', {
      personalNumber,
      password,
    }),
  logout: () => apiClient.post('/api/auth/logout'),
  me: () => apiClient.get<{ user: AuthUserDto }>('/api/auth/me'),
  changePassword: (newPassword: string) => apiClient.patch('/api/auth/password', { newPassword }),
  listUsers: () => apiClient.get<{ users: AuthUserDto[] }>('/api/auth/users'),
};

export const findingsApi = {
  list: (params?: FindingListParams) => apiClient.get<FindingsListDto>(buildQuery('/api/findings', params)),
  get: (id: string) => apiClient.get<{ finding: FindingDto }>(`/api/findings/${id}`),
  create: (payload: CreateFindingDto) => apiClient.post<{ finding: FindingDto }>('/api/findings', payload),
  bulkCreate: (findings: CreateFindingDto[]) =>
    apiClient.post<{ findings: FindingDto[]; count: number }>('/api/findings/bulk', { findings }),
  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch<{ finding: FindingDto }>(`/api/findings/${id}/status`, { status, note }),
  assign: (id: string, assigneeId: string) =>
    apiClient.patch<{ finding: FindingDto }>(`/api/findings/${id}/assign`, { assigneeId }),
  stats: () => apiClient.get<FindingStatsDto>('/api/findings/stats'),
};

export const tasksApi = {
  list: (params?: TaskListParams) => apiClient.get<TasksListDto>(buildQuery('/api/tasks', params)),
  get: (id: string) => apiClient.get<{ task: TaskDto }>(`/api/tasks/${id}`),
  create: (payload: CreateTaskDto) => apiClient.post<{ task: TaskDto }>('/api/tasks', payload),
  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch<{ task: TaskDto }>(`/api/tasks/${id}/status`, { status, note }),
  complete: (id: string, outcome: string, outcomeType: string) =>
    apiClient.post<{ task: TaskDto }>(`/api/tasks/${id}/complete`, { outcome, outcomeType }),
};

export const rulesApi = {
  list: (params?: { type?: string; status?: string }) =>
    apiClient.get<RulesListDto>(buildQuery('/api/rules', params)),
  get: (id: string) => apiClient.get<{ rule: RuleDto }>(`/api/rules/${id}`),
  create: (payload: CreateRuleDto) => apiClient.post<{ rule: RuleDto }>('/api/rules', payload),
  approve: (id: string) => apiClient.patch<{ rule: RuleDto }>(`/api/rules/${id}/approve`),
  updateThreshold: (id: string, thresholdValue: unknown, changeDescription: string) =>
    apiClient.patch<{ rule: RuleDto }>(`/api/rules/${id}/threshold`, {
      thresholdValue,
      changeDescription,
    }),
  updateStatus: (id: string, status: string) =>
    apiClient.patch<{ rule: RuleDto }>(`/api/rules/${id}/status`, { status }),
};

export const dossiersApi = {
  list: (params?: { tailNumber?: string; status?: string }) =>
    apiClient.get<DossiersListDto>(buildQuery('/api/dossiers', params)),
  get: (id: string) => apiClient.get<{ dossier: DossierWithFindingsDto }>(`/api/dossiers/${id}`),
  create: (payload: CreateDossierDto) => apiClient.post<{ dossier: DossierDto }>('/api/dossiers', payload),
  syncStatus: (id: string) => apiClient.post<{ dossier: DossierDto }>(`/api/dossiers/${id}/sync-status`),
};

export const auditApi = {
  list: (limit?: number, offset?: number) =>
    apiClient.get<AuditListDto>(buildQuery('/api/audit', { limit, offset })),
  forFinding: (findingId: string) => apiClient.get<AuditListDto>(`/api/audit/finding/${findingId}`),
  forEntity: (type: string, id: string) => apiClient.get<AuditListDto>(`/api/audit/entity/${type}/${id}`),
};

export const ingestionApi = {
  uploadCsv: (
    csvContent: string,
    sourceFilename?: string,
    onProgress?: (percent: number) => void,
  ): Promise<ApiResponse<CsvIngestionDto>> => uploadCsvRequest(csvContent, sourceFilename, onProgress),
};

export const operationsFlightsApi = {
  list: (sampleSize?: number) =>
    apiClient.get<OperationsFlightsListDto>(buildQuery('/api/operations/flights', { sampleSize })),
  get: (flightId: string) => apiClient.get<{ flight: OperationsFlightDto }>(`/api/operations/flights/${flightId}`),
};

export const healthApi = {
  check: () =>
    request<{ status: string; version: string; uptime: number }>('GET', '/api/health', undefined, { auth: false }),
};

export interface AuthUserDto {
  id: string;
  personalNumber: string;
  name: string;
  nameHe: string;
  role: string;
  roleHe: string;
  unit: string;
  unitHe: string;
  rank: string;
  rankHe: string;
  permissions: string[];
  isActive: boolean;
}

export interface FindingDto {
  id: string;
  title: string;
  titleHe?: string;
  summary?: string;
  summaryHe?: string;
  severity: string;
  classification?: string;
  sourceType: string;
  aircraftId?: string;
  flightId?: string;
  dossierId?: string;
  ruleId?: string;
  evidenceRefs: string[];
  status: string;
  assignedTo?: string;
  generatedBy?: string;
  reviewNotes?: string;
  escalationInfo?: string;
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FindingsListDto {
  findings: FindingDto[];
  count: number;
}

export interface FindingStatsDto {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  open: number;
}

export interface FindingListParams {
  status?: string;
  severity?: string;
  aircraftId?: string;
  flightId?: string;
  dossierId?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

export interface CreateFindingDto {
  title: string;
  titleHe?: string;
  summary?: string;
  summaryHe?: string;
  severity: string;
  classification?: string;
  sourceType?: string;
  aircraftId?: string;
  flightId?: string;
  dossierId?: string;
  ruleId?: string;
  evidenceRefs?: string[];
  generatedBy?: string;
}

export interface TaskDto {
  id: string;
  title: string;
  findingId?: string;
  assignedTo?: string;
  assignedRole?: string;
  priority: string;
  status: string;
  dueDate?: string;
  notes?: string;
  outcome?: string;
  outcomeType?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TasksListDto {
  tasks: TaskDto[];
  count: number;
}

export interface TaskListParams {
  findingId?: string;
  assignedTo?: string;
  status?: string;
}

export interface CreateTaskDto {
  title: string;
  findingId?: string;
  assignedTo?: string;
  assignedRole?: string;
  priority?: string;
  dueDate?: string;
  notes?: string;
}

export interface RuleDto {
  id: string;
  ruleId: string;
  type: string;
  system?: string;
  systemHe?: string;
  parameter: string;
  thresholdType: string;
  thresholdValue: number | [number, number];
  unit?: string;
  context: string;
  referenceDoc?: string;
  clause?: string;
  name?: string;
  description?: string;
  severity: string;
  severityS: string;
  status: string;
  version: number;
  versionHistory: unknown[];
  metrics: unknown;
  createdBy?: string;
  approvedBy?: string;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface RulesListDto {
  rules: RuleDto[];
  count: number;
}

export interface CreateRuleDto {
  ruleId?: string;
  type?: string;
  system?: string;
  systemHe?: string;
  parameter: string;
  thresholdType: string;
  thresholdValue: number | [number, number];
  unit?: string;
  context?: string;
  referenceDoc?: string;
  clause?: string;
  name?: string;
  description?: string;
  severity: string;
  severityS: string;
}

export interface DossierDto {
  id: string;
  flightId?: string;
  tailNumber?: string;
  flightDate?: string;
  pilotName?: string;
  status: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DossierWithFindingsDto extends DossierDto {
  findings: FindingDto[];
}

export interface DossiersListDto {
  dossiers: DossierDto[];
  count: number;
}

export interface CreateDossierDto {
  flightId?: string;
  tailNumber?: string;
  flightDate?: string;
  pilotName?: string;
}

export interface AuditEntryDto {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
  approvalRequired?: boolean;
  relatedFinding?: string;
  relatedTask?: string;
  relatedRule?: string;
  timestamp: string;
}

export interface AuditListDto {
  entries: AuditEntryDto[];
  count: number;
}

export interface OperationsTelemetryRecordDto {
  timestamp: string;
  phase: string;
  parameters: Record<string, number>;
}

export interface OperationsFlightDto {
  flightId: string;
  tailNumber: string;
  missionType: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  phases: string[];
  availableParameters: string[];
  recordCount: number;
  records: OperationsTelemetryRecordDto[];
  createdAt: string;
  updatedAt: string;
}

export interface OperationsFlightsListDto {
  flights: OperationsFlightDto[];
  count: number;
}

export interface CsvIngestionDto {
  batchId: string;
  recordCount: number;
  flightCount: number;
  findingCount: number;
  availableParameters: string[];
}

function buildQuery(base: string, params?: Record<string, unknown>): string {
  if (!params) return base;

  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      q.set(key, String(value));
    }
  });

  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

function uploadCsvRequest(
  csvContent: string,
  sourceFilename?: string,
  onProgress?: (percent: number) => void,
): Promise<ApiResponse<CsvIngestionDto>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/ingestion/csv`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    const token = tokenStore.get();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }

      onProgress(Math.max(1, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };

    xhr.onerror = () => {
      resolve({
        error: 'Network error - is the local server running?',
        errorHe: 'שגיאת רשת - האם השרת המקומי פועל?',
        status: 0,
        ok: false,
      });
    };

    xhr.onload = () => {
      let parsed: unknown;

      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        resolve({
          error: 'Invalid response from server',
          status: xhr.status,
          ok: false,
        });
        return;
      }

      if (xhr.status === 401) {
        tokenStore.clear();
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          data: parsed as CsvIngestionDto,
          status: xhr.status,
          ok: true,
        });
        return;
      }

      const payload = parsed as { error?: string; errorHe?: string } | undefined;
      resolve({
        error: payload?.error || 'CSV ingestion failed',
        errorHe: payload?.errorHe,
        status: xhr.status,
        ok: false,
      });
    };

    xhr.send(JSON.stringify({ csvContent, sourceFilename }));
  });
}
