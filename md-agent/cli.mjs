#!/usr/bin/env node

import inquirer from "inquirer";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Colors ───────────────────────────────────────────────────────────
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function banner() {
  console.log("");
  console.log(cyan("  ╔══════════════════════════════════════════════════╗"));
  console.log(cyan("  ║") + bold("                                                  ") + cyan("║"));
  console.log(cyan("  ║") + bold("    🛠️  Dev Agents — Smart Project Toolkit        ") + cyan("║"));
  console.log(cyan("  ║") + bold("                                                  ") + cyan("║"));
  console.log(cyan("  ╚══════════════════════════════════════════════════╝"));
  console.log(dim("  Your interactive CLI agents for faster development.\n"));
}

const AGENTS = [
  {
    name: "📄  MD Agent        — Generate project docs (CLAUDE.md, README, etc.)",
    value: "md",
    script: "index.mjs",
    description: "Generates CLAUDE.md, README.md, CONTRIBUTING.md with presets",
  },
  {
    name: "📦  Component Agent — Generate React/Next.js components",
    value: "component",
    script: "agents/component-agent.mjs",
    description: "Creates components with props, hooks, ShadCN, stories & tests",
  },
  {
    name: "🔌  API Agent       — Generate API endpoints & routes",
    value: "api",
    script: "agents/api-agent.mjs",
    description: "Creates Next.js or Express routes with validation schemas",
  },
  {
    name: "🧪  Test Agent      — Generate tests for your code",
    value: "test",
    script: "agents/test-agent.mjs",
    description: "Analyzes source files and generates matching test files",
  },
  {
    name: "🌿  Git Agent       — Smart git workflow manager",
    value: "git",
    script: "agents/git-agent.mjs",
    description: "Smart commit, branch, push/pull, and PR creation",
  },
];

async function main() {
  banner();

  let running = true;

  while (running) {
    const { agent } = await inquirer.prompt([
      {
        type: "list",
        name: "agent",
        message: "Select an agent:",
        choices: [
          ...AGENTS,
          new inquirer.Separator(),
          { name: "👋  Exit", value: "exit" },
        ],
      },
    ]);

    if (agent === "exit") {
      running = false;
      console.log(green("\n  Bye!\n"));
      break;
    }

    const selected = AGENTS.find((a) => a.value === agent);
    const scriptPath = join(__dirname, selected.script);

    console.log(dim(`\n  Launching ${selected.value} agent...\n`));

    try {
      execSync(`node "${scriptPath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (e) {
      // Agent exited — return to menu
    }

    console.log("");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
