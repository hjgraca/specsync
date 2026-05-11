import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Mark } from "../../../shared/types.js";

export interface SelectionContext {
  quote: string;
  contextBefore: string;
  contextAfter: string;
}

interface Props {
  markdown: string;
  marks: Mark[];
  selectedText: string;
  activeMarkId: string | null;
  onTextSelect: (text: string) => void;
  onComment: (ctx: SelectionContext, text: string) => void;
  onSuggest: (ctx: SelectionContext, content: string) => void;
  onHighlightClick: (markId: string) => void;
}

export function MarkdownViewer({ markdown, marks, onTextSelect, onComment, onSuggest, activeMarkId, onHighlightClick }: Props) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [commentText, setCommentText] = useState("");
  const [mode, setMode] = useState<"idle" | "comment" | "suggest">("idle");
  const selectionCtxRef = useRef<SelectionContext>({ quote: "", contextBefore: "", contextAfter: "" });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    highlightMarks(contentRef.current, marks, activeMarkId, onHighlightClick);
  }, [marks, markdown, activeMarkId, onHighlightClick]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".comment-input-panel")) {
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const quote = selection.toString().trim();

      const ctx = getSelectionContext(contentRef.current!, selection);
      selectionCtxRef.current = ctx;

      onTextSelect(quote);
      setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setShowToolbar(true);
      setMode("idle");
    } else if (mode === "idle") {
      setShowToolbar(false);
      onTextSelect("");
      selectionCtxRef.current = { quote: "", contextBefore: "", contextAfter: "" };
    }
  }, [onTextSelect, mode]);

  const handleComment = () => setMode("comment");
  const handleSuggest = () => setMode("suggest");

  const submitComment = () => {
    if (selectionCtxRef.current.quote && commentText.trim()) {
      onComment(selectionCtxRef.current, commentText.trim());
      setCommentText("");
      setShowToolbar(false);
      setMode("idle");
    }
  };

  const submitSuggestion = () => {
    if (selectionCtxRef.current.quote && commentText.trim()) {
      onSuggest(selectionCtxRef.current, commentText.trim());
      setCommentText("");
      setShowToolbar(false);
      setMode("idle");
    }
  };

  const cancel = () => {
    setMode("idle");
    setShowToolbar(false);
    setCommentText("");
  };

  return (
    <div onMouseUp={handleMouseUp} style={{ position: "relative" }}>
      <div ref={contentRef} className="markdown-body" style={{ maxWidth: "800px", margin: "0 auto" }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{markdown}</ReactMarkdown>
      </div>

      {showToolbar && mode === "idle" && (
        <div
          style={{
            position: "fixed",
            left: toolbarPos.x - 80,
            top: toolbarPos.y - 40,
            background: "#1a1a2e",
            borderRadius: "6px",
            padding: "4px",
            display: "flex",
            gap: "2px",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <button onClick={handleComment} style={toolbarButtonStyle}>Comment</button>
          <button onClick={handleSuggest} style={toolbarButtonStyle}>Suggest</button>
        </div>
      )}

      {showToolbar && (mode === "comment" || mode === "suggest") && (
        <div
          className="comment-input-panel"
          style={{
            position: "fixed",
            left: toolbarPos.x - 150,
            top: toolbarPos.y - 120,
            background: "#fff",
            borderRadius: "8px",
            padding: "12px",
            width: "300px",
            zIndex: 1000,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            border: "1px solid #e0e0e0",
          }}
        >
          <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "8px" }}>
            {mode === "comment" ? "Add comment on:" : "Suggest replacement for:"}
            <em> &ldquo;{selectionCtxRef.current.quote.slice(0, 50)}{selectionCtxRef.current.quote.length > 50 ? "..." : ""}&rdquo;</em>
          </p>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={mode === "comment" ? "Your comment..." : "Replacement text..."}
            autoFocus
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #d0d0d0",
              fontSize: "0.9rem",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              onClick={mode === "comment" ? submitComment : submitSuggestion}
              disabled={!commentText.trim()}
              style={{
                ...submitButtonStyle,
                background: mode === "comment" ? "#3b82f6" : "#8b5cf6",
                opacity: commentText.trim() ? 1 : 0.5,
              }}
            >
              {mode === "comment" ? "Comment" : "Suggest"}
            </button>
            <button onClick={cancel} style={{ ...submitButtonStyle, background: "#6b7280" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getSelectionContext(container: HTMLElement, selection: Selection): SelectionContext {
  const fullText = container.textContent || "";
  const quote = selection.toString().trim();

  const range = selection.getRangeAt(0);
  const preRange = document.createRange();
  preRange.setStart(container, 0);
  preRange.setEnd(range.startContainer, range.startOffset);
  const offsetStart = preRange.toString().length;

  const contextBefore = fullText.slice(Math.max(0, offsetStart - 40), offsetStart);
  const contextAfter = fullText.slice(offsetStart + quote.length, offsetStart + quote.length + 40);

  return { quote, contextBefore, contextAfter };
}

function highlightMarks(
  container: HTMLElement,
  marks: Mark[],
  activeMarkId: string | null,
  onHighlightClick: (markId: string) => void,
): void {
  container.querySelectorAll("mark[data-mark-id]").forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ""), el);
      parent.normalize();
    }
  });

  const unresolvedMarks = marks.filter((m) => !m.resolved && m.quote !== "[general]");
  const fullText = container.textContent || "";

  for (const mark of unresolvedMarks) {
    const position = findQuotePosition(fullText, mark.quote, mark.contextBefore, mark.contextAfter);
    if (position === -1) continue;

    const markEl = wrapTextAtPosition(container, position, mark.quote.length, mark.id, mark.id === activeMarkId);
    if (markEl) {
      markEl.onclick = (e) => {
        e.stopPropagation();
        onHighlightClick(mark.id);
      };
    }
  }
}

function findQuotePosition(fullText: string, quote: string, contextBefore?: string, contextAfter?: string): number {
  if (!contextBefore && !contextAfter) {
    return fullText.indexOf(quote);
  }

  let bestPos = -1;
  let bestScore = -1;
  let searchFrom = 0;

  while (true) {
    const pos = fullText.indexOf(quote, searchFrom);
    if (pos === -1) break;

    let score = 0;
    if (contextBefore) {
      const actualBefore = fullText.slice(Math.max(0, pos - contextBefore.length), pos);
      score += commonSuffixLength(contextBefore, actualBefore);
    }
    if (contextAfter) {
      const actualAfter = fullText.slice(pos + quote.length, pos + quote.length + (contextAfter?.length || 0));
      score += commonPrefixLength(contextAfter, actualAfter);
    }

    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }

    searchFrom = pos + 1;
  }

  return bestPos;
}

function commonSuffixLength(a: string, b: string): number {
  let count = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[a.length - 1 - i] === b[b.length - 1 - i]) count++;
    else break;
  }
  return count;
}

function commonPrefixLength(a: string, b: string): number {
  let count = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) count++;
    else break;
  }
  return count;
}

function wrapTextAtPosition(container: HTMLElement, position: number, length: number, markId: string, isActive: boolean): HTMLElement | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const nodeLen = node.textContent?.length || 0;
    if (currentOffset + nodeLen > position) {
      const localStart = position - currentOffset;
      const localEnd = Math.min(localStart + length, nodeLen);

      const range = document.createRange();
      range.setStart(node, localStart);
      range.setEnd(node, localEnd);

      const markEl = document.createElement("mark");
      markEl.setAttribute("data-mark-id", markId);
      markEl.style.backgroundColor = isActive ? "#fbbf24" : "#fef08a";
      markEl.style.borderRadius = "2px";
      markEl.style.cursor = "pointer";
      markEl.style.padding = "1px 0";
      if (isActive) {
        markEl.style.outline = "2px solid #f59e0b";
      }

      range.surroundContents(markEl);
      return markEl;
    }
    currentOffset += nodeLen;
  }

  return null;
}

const toolbarButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "#fff",
  border: "none",
  padding: "6px 12px",
  borderRadius: "4px",
  fontSize: "0.85rem",
  cursor: "pointer",
};

const submitButtonStyle: React.CSSProperties = {
  color: "#fff",
  border: "none",
  padding: "6px 14px",
  borderRadius: "4px",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};
