import { useState } from "react";
import type { StructuredQuestion } from "../../../shared/types.js";

interface Props {
  question: StructuredQuestion;
  currentAnswer?: string;
  onSubmit: (answer: string) => void;
}

export function QuestionForm({ question, currentAnswer, onSubmit }: Props) {
  const [selected, setSelected] = useState<string>(currentAnswer || question.default || "");
  const [freeText, setFreeText] = useState("");
  const [otherText, setOtherText] = useState("");

  const isAnswered = currentAnswer !== undefined;
  const isOtherSelected = selected === "other";

  const handleSubmit = () => {
    if (isFreeText) {
      onSubmit(freeText);
    } else if (isOtherSelected) {
      onSubmit(`other: ${otherText}`);
    } else {
      onSubmit(selected);
    }
  };

  const isFreeText = question.type === "free-text" || !question.options || question.options.length === 0;

  const canSubmit = () => {
    if (isFreeText) return freeText.trim().length > 0;
    if (isOtherSelected) return otherText.trim().length > 0;
    return selected.length > 0;
  };

  return (
    <div
      style={{
        marginBottom: isAnswered ? "0.5rem" : "1.5rem",
        padding: isAnswered ? "0.75rem 1rem" : "1.5rem",
        background: isAnswered ? "#f0fdf4" : "#fff",
        borderRadius: "8px",
        border: `1px solid ${isAnswered ? "#86efac" : "#e0e0e0"}`,
      }}
    >
      {isAnswered ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#16a34a" }}>✓</span>
          <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{question.title}</span>
          <span style={{ color: "#166534", fontSize: "0.85rem", marginLeft: "auto" }}>
            {(() => {
              const opt = question.options?.find(o => o.key === currentAnswer);
              return opt ? `${opt.label} (${currentAnswer})` : currentAnswer;
            })()}
          </span>
        </div>
      ) : (
      <>
      <h3 style={{ marginBottom: "0.5rem" }}>{question.title}</h3>
      {question.context && (
        <p style={{ color: "#555", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
          {question.context}
        </p>
      )}
      {question.recommendation && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.6rem 0.75rem",
          background: "#eff6ff",
          borderRadius: "6px",
          borderLeft: "3px solid #3b82f6",
          fontSize: "0.85rem",
          color: "#1e40af",
        }}>
          <strong>Recommendation:</strong> {question.recommendation}
        </div>
      )}

        <>
          {isFreeText ? (
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Type your answer..."
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "0.75rem",
                borderRadius: "6px",
                border: "1px solid #d0d0d0",
                fontSize: "0.95rem",
                resize: "vertical",
              }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {question.options.map((opt) => (
                <label
                  key={opt.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    border: `1px solid ${selected === opt.key ? "#3b82f6" : "#e0e0e0"}`,
                    background: selected === opt.key ? "#eff6ff" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type={question.type === "multi-select" ? "checkbox" : "radio"}
                    name={question.id}
                    value={opt.key}
                    checked={selected === opt.key}
                    onChange={() => setSelected(opt.key)}
                    style={{ accentColor: "#3b82f6" }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {opt.label}
                      {opt.recommended && (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "#16a34a", fontWeight: 600 }}>
                          Recommended
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              ))}

              {/* Other — type your own answer */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  border: `1px solid ${isOtherSelected ? "#3b82f6" : "#e0e0e0"}`,
                  background: isOtherSelected ? "#eff6ff" : "transparent",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name={question.id}
                  value="other"
                  checked={isOtherSelected}
                  onChange={() => setSelected("other")}
                  style={{ accentColor: "#3b82f6" }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Other</div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>Type your own answer below</div>
                </div>
              </label>

              {isOtherSelected && (
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Describe your preference..."
                  autoFocus
                  style={{
                    width: "100%",
                    minHeight: "60px",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #3b82f6",
                    fontSize: "0.95rem",
                    resize: "vertical",
                    marginTop: "0.25rem",
                  }}
                />
              )}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            style={{
              marginTop: "1rem",
              padding: "0.6rem 1.5rem",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
              opacity: canSubmit() ? 1 : 0.5,
            }}
          >
            Submit Answer
          </button>
        </>
      </>
      )}
    </div>
  );
}
