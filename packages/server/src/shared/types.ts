export interface Document {
  slug: string;
  title: string;
  markdown: string;
  marks: Record<string, Mark>;
  revision: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export type DocumentStatus = "active" | "approved" | "changes_requested";

export interface Mark {
  id: string;
  type: MarkType;
  by: string;
  quote: string;
  contextBefore?: string;
  contextAfter?: string;
  text?: string;
  content?: string;
  kind?: SuggestionKind;
  thread: ThreadEntry[];
  resolved: boolean;
  revision: number;
  createdAt: string;
}

export type MarkType = "comment" | "suggestion";
export type SuggestionKind = "replace" | "insert" | "delete";

export interface ThreadEntry {
  by: string;
  text: string;
  createdAt: string;
}

export interface DocumentEvent {
  id: number;
  slug: string;
  type: EventType;
  data: Record<string, unknown>;
  actor: string;
  createdAt: string;
}

export type EventType =
  | "comment.added"
  | "comment.replied"
  | "suggestion.added"
  | "suggestion.accepted"
  | "suggestion.rejected"
  | "comment.resolved"
  | "document.approved"
  | "document.changes_requested"
  | "document.revised";

export interface QASession {
  id: string;
  title: string;
  questions: StructuredQuestion[];
  answers: Record<string, string>;
  discussions: Record<string, DiscussionMessage[]>;
  status: "active" | "completed";
  createdAt: string;
}

export interface StructuredQuestion {
  id: string;
  title: string;
  context?: string;
  recommendation?: string;
  options: QuestionOption[];
  default?: string;
  type: "single-select" | "multi-select" | "free-text" | "confirm";
}

export interface QuestionOption {
  key: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface DiscussionMessage {
  by: string;
  text: string;
  createdAt: string;
}

export interface PresenceEntry {
  id: string;
  name: string;
  role: AccessRole;
  status?: string;
  connectedAt: string;
}

export type AccessRole = "viewer" | "commenter" | "editor" | "owner";

export interface CreateDocumentRequest {
  title: string;
  markdown: string;
  files?: string[];
}

export interface CreateDocumentResponse {
  slug: string;
  docUrl: string;
  bridgeUrl: string;
  accessToken: string;
  ownerSecret: string;
  joinCode: string;
}

export interface DocumentState {
  slug: string;
  title: string;
  markdown: string;
  marks: Record<string, Mark>;
  revision: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OpsRequest {
  type: string;
  [key: string]: unknown;
}

export interface ApprovalResult {
  status: "approved" | "changes_requested";
  changesSummary?: string;
  approvedBy?: string;
  comments?: { section: string; comment: string }[];
}
