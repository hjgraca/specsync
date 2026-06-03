import { useState } from "react";

interface Participant {
  id: string;
  name: string;
}

const NAME_KEY = "specsync_name";
const ID_KEY = "specsync_participant_id";

function loadStoredName(): string {
  return localStorage.getItem(NAME_KEY) || "";
}

/**
 * The participant's display name and a stable per-browser id. The name is chosen
 * by the person (no auto-generated codenames) and shared across every document,
 * so returning visitors keep the same name. `setName` persists it.
 */
export function useParticipant() {
  const [id] = useState<string>(() => {
    const stored = localStorage.getItem(ID_KEY);
    if (stored) return stored;
    const fresh = `viewer-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ID_KEY, fresh);
    return fresh;
  });

  const [name, setNameState] = useState<string>(loadStoredName);

  const setName = (next: string) => {
    const trimmed = next.trim();
    localStorage.setItem(NAME_KEY, trimmed);
    setNameState(trimmed);
  };

  const participant: Participant = { id, name };
  return { participant, setName };
}
