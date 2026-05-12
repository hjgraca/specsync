#!/usr/bin/env node

import * as p from "@clack/prompts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface AgentTarget {
  id: string;
  label: string;
  dir: string;
  skillSource: string;
}

const TARGETS: AgentTarget[] = [
  { id: "claude", label: "Claude Code", dir: ".claude/skills/specsync", skillSource: "claude" },
  { id: "cursor", label: "Cursor", dir: ".cursor/skills/specsync", skillSource: "cursor" },
  { id: "opencode", label: "OpenCode", dir: ".opencode/skills/specsync", skillSource: "opencode" },
  { id: "copilot", label: "GitHub Copilot / Codex", dir: ".agents/skills/specsync", skillSource: "copilot" },
  { id: "kiro", label: "Kiro", dir: ".kiro/skills/specsync", skillSource: "kiro" },
  { id: "pi", label: "Pi", dir: ".pi/skills/specsync", skillSource: "pi" },
  { id: "universal", label: "Universal (.agents/)", dir: ".agents/skills/specsync", skillSource: "universal" },
];

function detectAgents(cwd: string): string[] {
  const detected: string[] = [];
  const dirToId: Record<string, string> = {
    ".claude": "claude",
    ".cursor": "cursor",
    ".opencode": "opencode",
    ".agents": "copilot",
    ".kiro": "kiro",
    ".pi": "pi",
  };

  for (const [dir, id] of Object.entries(dirToId)) {
    if (existsSync(resolve(cwd, dir))) {
      detected.push(id);
    }
  }

  return detected;
}

async function main() {
  const cwd = process.cwd();

  p.intro("Specsync — Install skills for your AI coding agents");

  const detected = detectAgents(cwd);

  const agents = await p.multiselect({
    message: "Which agents should get the specsync skill?",
    options: TARGETS.map((t) => ({
      value: t.id,
      label: t.label,
      hint: detected.includes(t.id) ? "detected" : undefined,
    })),
    initialValues: detected,
    required: true,
  });

  if (p.isCancel(agents)) {
    p.cancel("Installation cancelled.");
    process.exit(0);
  }

  const serverUrl = await p.text({
    message: "Specsync server URL (press Tab to use default):",
    placeholder: "http://localhost:4000",
    defaultValue: "http://localhost:4000",
    validate: (value) => {
      try {
        new URL(value);
        return undefined;
      } catch {
        return "Please enter a valid URL";
      }
    },
  });

  if (p.isCancel(serverUrl)) {
    p.cancel("Installation cancelled.");
    process.exit(0);
  }

  const s = p.spinner();
  s.start("Installing skills...");

  const selectedTargets = TARGETS.filter((t) => (agents as string[]).includes(t.id));
  const skillsDir = resolve(__dirname, "../skills");

  for (const target of selectedTargets) {
    const destDir = resolve(cwd, target.dir);
    const destFile = join(destDir, "SKILL.md");

    mkdirSync(destDir, { recursive: true });

    let skillPath = resolve(skillsDir, target.skillSource, "SKILL.md");
    if (!existsSync(skillPath)) {
      skillPath = resolve(skillsDir, "universal", "SKILL.md");
    }

    const content = readFileSync(skillPath, "utf-8");
    writeFileSync(destFile, content, "utf-8");
  }

  const configPath = resolve(cwd, ".specsync.json");
  const config = { serverUrl: serverUrl as string };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  s.stop("Skills installed!");

  p.note(
    selectedTargets.map((t) => `  ${t.label} → ${t.dir}/SKILL.md`).join("\n"),
    "Installed to:",
  );

  p.outro(
    `Server URL saved to .specsync.json

  Next steps:
  1. Start the server (if not running): npx @specsync/server
  2. Tell your agent: "ask the team about..." or "submit for review"
     It will create a session and give you a URL to open in the browser.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
