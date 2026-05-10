import { useState, useEffect } from "react";

const ADJECTIVES = [
  "swift", "bold", "quiet", "bright", "cosmic", "golden", "silver", "crystal",
  "noble", "vivid", "gentle", "fierce", "clever", "steady", "spiffy", "misty",
  "frozen", "blazing", "dancing", "silent", "hidden", "mighty", "ancient", "lucky",
];

const NOUNS = [
  "waterfall", "falcon", "phoenix", "river", "mountain", "thunder", "forest", "aurora",
  "comet", "glacier", "canyon", "meadow", "nebula", "harbor", "valley", "summit",
  "breeze", "storm", "ember", "tide", "reef", "grove", "cliff", "dune",
];

function generateCodename(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}

interface Participant {
  id: string;
  name: string;
}

const STORAGE_KEY_PREFIX = "specsync_participant_";

export function useParticipant(sessionId: string) {
  const [participant] = useState<Participant>(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored);

    const p: Participant = {
      id: `viewer-${Math.random().toString(36).slice(2, 10)}`,
      name: generateCodename(),
    };
    localStorage.setItem(storageKey, JSON.stringify(p));
    return p;
  });

  return participant;
}
