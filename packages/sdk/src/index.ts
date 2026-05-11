export { ReviewToolClient } from "./client.js";
export { participateInReview } from "./bridge.js";
export { ask } from "./tools/ask.js";
export { submitForReview } from "./tools/submit-for-review.js";
export { waitForApproval } from "./tools/wait-for-approval.js";

export type { BridgeOptions } from "./bridge.js";
export type { AskParams, AskResult } from "./tools/ask.js";
export type { SubmitForReviewParams, SubmitForReviewResult } from "./tools/submit-for-review.js";
export type { WaitForApprovalParams } from "./tools/wait-for-approval.js";

export type {
  Document,
  DocumentStatus,
  Mark,
  MarkType,
  SuggestionKind,
  ThreadEntry,
  DocumentEvent,
  EventType,
  QASession,
  StructuredQuestion,
  QuestionOption,
  DiscussionMessage,
  PresenceEntry,
  AccessRole,
  CreateDocumentRequest,
  CreateDocumentResponse,
  DocumentState,
  OpsRequest,
  ApprovalResult,
} from "./types.js";
