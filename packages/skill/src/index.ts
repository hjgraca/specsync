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

const VALID_AGENT_IDS = TARGETS.map((t) => t.id);

interface CliArgs {
  agent?: string;
  all?: boolean;
  serverUrl: string;
  help?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { serverUrl: "http://localhost:4000" };
  const rawArgs = argv.slice(2);

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--all") {
      args.all = true;
    } else if (arg === "--agent" && i + 1 < rawArgs.length) {
      args.agent = rawArgs[++i];
    } else if (arg.startsWith("--agent=")) {
      args.agent = arg.split("=")[1];
    } else if (arg === "--server-url" && i + 1 < rawArgs.length) {
      args.serverUrl = rawArgs[++i];
    } else if (arg.startsWith("--server-url=")) {
      args.serverUrl = arg.split("=").slice(1).join("=");
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`Usage: specsync-skill [options]

Install specsync skills for AI coding agents.

Options:
  --agent <id>          Install skill for a single agent
                        Valid: ${VALID_AGENT_IDS.join(", ")}
  --all                 Install skills for all agents
  --server-url <url>    Specsync server URL (default: http://localhost:4000)
  -h, --help            Show this help message

Examples:
  specsync-skill                                          # interactive mode
  specsync-skill --agent opencode                         # non-interactive, single agent
  specsync-skill --all                                    # non-interactive, all agents
  specsync-skill --agent claude --server-url https://specsync.myteam.com

When run without --agent or --all, the installer runs in interactive mode.`);
}

function installSkills(selectedTargets: AgentTarget[], serverUrl: string, cwd: string): void {
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
  const config = { serverUrl };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function runNonInteractive(args: CliArgs): void {
  const cwd = process.cwd();

  if (args.agent && args.all) {
    console.error("Error: --agent and --all are mutually exclusive.");
    process.exit(1);
  }

  // Validate server URL
  try {
    new URL(args.serverUrl);
  } catch {
    console.error(`Error: Invalid server URL: ${args.serverUrl}`);
    process.exit(1);
  }

  let selectedTargets: AgentTarget[];

  if (args.all) {
    selectedTargets = TARGETS;
  } else if (args.agent) {
    if (!VALID_AGENT_IDS.includes(args.agent)) {
      console.error(`Error: Unknown agent "${args.agent}". Valid agents: ${VALID_AGENT_IDS.join(", ")}`);
      process.exit(1);
    }
    selectedTargets = TARGETS.filter((t) => t.id === args.agent);
  } else {
    // Should not reach here, but just in case
    console.error("Error: --agent <id> or --all is required in non-interactive mode.");
    process.exit(1);
  }

  installSkills(selectedTargets, args.serverUrl, cwd);

  for (const target of selectedTargets) {
    console.log(`Installed: ${target.label} → ${target.dir}/SKILL.md`);
  }
  console.log(`Server URL saved to .specsync.json (${args.serverUrl})`);
}

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

async function runInteractive(): Promise<void> {
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

  installSkills(selectedTargets, serverUrl as string, cwd);

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

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.agent || args.all) {
    runNonInteractive(args);
  } else {
    await runInteractive();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
