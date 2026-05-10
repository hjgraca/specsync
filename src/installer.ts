import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGETS: Record<string, { dir: string; skillSource: string; description: string }> = {
  agents: { dir: ".agents/skills/specsync", skillSource: "universal", description: "Universal Agent Skills standard (Copilot, Codex)" },
  claude: { dir: ".claude/skills/specsync", skillSource: "claude", description: "Claude Code" },
  copilot: { dir: ".agents/skills/specsync", skillSource: "copilot", description: "Copilot CLI" },
  kiro: { dir: ".kiro/skills/specsync", skillSource: "kiro", description: "Kiro / Kiro CLI" },
  cursor: { dir: ".cursor/skills/specsync", skillSource: "cursor", description: "Cursor" },
  pi: { dir: ".pi/skills/specsync", skillSource: "pi", description: "Pi" },
  all: { dir: "", skillSource: "", description: "All supported targets" },
};

export function printInstallerHelp() {
  console.log(`
  Specsync Installer

  Usage:
    npx specsync install --to <target> [--output <dir>]
    npx specsync install --to all

  Targets:
    claude    ${TARGETS.claude.description}
    copilot   ${TARGETS.copilot.description}
    kiro      ${TARGETS.kiro.description}
    cursor    ${TARGETS.cursor.description}
    pi        ${TARGETS.pi.description}
    agents    ${TARGETS.agents.description}
    all       Install to all targets

  Examples:
    npx specsync install --to claude
    npx specsync install --to all
    npx specsync install --to kiro --output ./my-project

  This copies the specsync skill (SKILL.md) into the correct
  directory for your AI coding tool. The skill tells your agent
  how to use the specsync server for collaborative spec review.
`);
}

export function install(args: string[]) {
  const toIdx = args.indexOf("--to");
  const target = toIdx !== -1 && args[toIdx + 1] ? args[toIdx + 1] : null;
  const outIdx = args.indexOf("--output");
  const output = outIdx !== -1 && args[outIdx + 1] ? resolve(args[outIdx + 1]) : process.cwd();

  if (!target) {
    console.error("Error: --to <target> is required. Options: claude, copilot, kiro, cursor, pi, agents, all");
    process.exit(1);
  }

  if (target === "all") {
    for (const [name, config] of Object.entries(TARGETS)) {
      if (name === "all") continue;
      installToTarget(name, config.dir, config.skillSource, output);
    }
    console.log("\n  Next: tell your agent \"ask the team\" or \"submit for review\"");
    console.log("  Server: npx specsync start\n");
    return;
  }

  const config = TARGETS[target];
  if (!config) {
    console.error(`Error: Unknown target "${target}". Options: ${Object.keys(TARGETS).join(", ")}`);
    process.exit(1);
  }

  installToTarget(target, config.dir, config.skillSource, output);
  console.log(`\n  Next: tell your agent "ask the team" or "submit for review"`);
  console.log("  Server: npx specsync start\n");
}

function installToTarget(target: string, relDir: string, skillSource: string, outputRoot: string) {
  const skillDir = resolve(outputRoot, relDir);
  const skillFile = join(skillDir, "SKILL.md");

  mkdirSync(skillDir, { recursive: true });

  const skillPath = resolve(__dirname, `../skills/${skillSource}/SKILL.md`);
  let skillContent: string;

  if (existsSync(skillPath)) {
    skillContent = readFileSync(skillPath, "utf-8");
  } else {
    const universalPath = resolve(__dirname, "../skills/universal/SKILL.md");
    skillContent = readFileSync(universalPath, "utf-8");
  }

  writeFileSync(skillFile, skillContent, "utf-8");
  console.log(`  ✓ Installed specsync skill to ${target}: ${skillDir}/SKILL.md`);
}
