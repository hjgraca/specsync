const ADJECTIVES = [
  "swift", "bold", "quiet", "bright", "cosmic", "golden", "silver", "crystal",
  "noble", "vivid", "gentle", "fierce", "clever", "steady", "spiffy", "misty",
  "frozen", "blazing", "dancing", "silent", "hidden", "mighty", "ancient", "lucky",
  "daring", "calm", "witty", "nimble", "jolly", "zen", "wary", "keen",
];

const NOUNS = [
  "waterfall", "falcon", "phoenix", "river", "mountain", "thunder", "forest", "aurora",
  "comet", "glacier", "canyon", "meadow", "nebula", "harbor", "valley", "summit",
  "breeze", "storm", "ember", "tide", "reef", "grove", "cliff", "dune",
  "spark", "frost", "bloom", "stone", "wave", "flame", "cedar", "hawk",
];

export function generateCodename(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}
