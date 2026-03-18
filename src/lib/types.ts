// ─── Upload Domain ───

export interface FileManifestEntry {
  path: string;
  size: number;
  language: string | null;
  priority: "high" | "medium" | "low";
}

export interface UploadResult {
  sessionId: string;
  fileCount: number;
  manifest: FileManifestEntry[];
  totalSize: number;
}

export interface UploadError {
  code: "FILE_TOO_LARGE" | "CORRUPTED_ARCHIVE" | "NO_PROJECT_FILES" | "UNSUPPORTED_FORMAT";
  message: string;
  maxSize?: number;
}

// ─── Analysis Domain ───

export interface ProjectAttributes {
  name: string;
  description: string;
  primaryLanguages: string[];
  frameworks: string[];
  keyFeatures: string[];
  projectType: string;
}

export interface AnalysisResult {
  sessionId: string;
  attributes: ProjectAttributes;
  confidence: "high" | "medium" | "low";
  additionalContextNeeded: boolean;
  contextPrompt?: string;
}

export interface AnalysisError {
  code: "INSUFFICIENT_CONTEXT" | "LLM_ERROR" | "SESSION_NOT_FOUND";
  message: string;
}

// ─── Summary Domain ───

export interface SummaryResult {
  sessionId: string;
  summary: string;
  characterCount: number;
  hashtags: string[];
}

export interface SummaryError {
  code: "GENERATION_FAILED" | "SESSION_NOT_FOUND" | "ANALYSIS_INCOMPLETE";
  message: string;
}

// ─── OAuth Domain ───

export interface OAuthError {
  code: "AUTH_FAILED" | "TOKEN_EXPIRED" | "TOKEN_REVOKED" | "REFRESH_FAILED";
  message: string;
  requiresReauth: boolean;
}

// ─── Publish Domain ───

export interface PublishResult {
  postUrn: string;
  postUrl: string;
}

export interface PublishError {
  code: "AUTH_REQUIRED" | "RATE_LIMITED" | "API_ERROR" | "INVALID_CONTENT";
  message: string;
  retryable: boolean;
  retryAfter?: number;
}
