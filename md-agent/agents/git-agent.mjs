#!/usr/bin/env node

import inquirer from "inquirer";
import { execSync } from "child_process";

// ─── Helpers ──────────────────────────────────────────────────────────
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: "pipe", ...opts }).trim();
  } catch (e) {
    if (opts.safe) return e.stderr || e.message;
    throw e;
  }
}

function banner() {
  console.log("");
  console.log(cyan("  ╔══════════════════════════════════════════╗"));
  console.log(cyan("  ║") + bold("        Git Agent — Smart Git Manager     ") + cyan("║"));
  console.log(cyan("  ╚══════════════════════════════════════════╝"));
  console.log(dim("  Automates git workflows with smart suggestions.\n"));
}

// ─── Git Status Analysis ──────────────────────────────────────────────
function analyzeRepo() {
  const branch = run("git branch --show-current");
  const status = run("git status --porcelain");
  const log = run("git log --oneline -5", { safe: true });
  const remotes = run("git remote -v", { safe: true });
  const hasUpstream = run("git rev-parse --abbrev-ref @{u} 2>/dev/null || echo none", { safe: true });

  const staged = [];
  const unstaged = [];
  const untracked = [];

  status.split("\n").filter(Boolean).forEach((line) => {
    const x = line[0];
    const y = line[1];
    const file = line.slice(3);
    if (x !== " " && x !== "?") staged.push(file);
    if (y !== " " && y !== "?") unstaged.push(file);
    if (x === "?") untracked.push(file);
  });

  return { branch, staged, unstaged, untracked, log, remotes, hasUpstream, status };
}

function showStatus(info) {
  console.log(bold("\n  📊 Repository Status:\n"));
  console.log(`  Branch:     ${cyan(info.branch)}`);
  console.log(`  Upstream:   ${info.hasUpstream === "none" ? red("none") : green(info.hasUpstream)}`);
  console.log(`  Staged:     ${info.staged.length > 0 ? yellow(info.staged.length + " files") : green("clean")}`);
  console.log(`  Unstaged:   ${info.unstaged.length > 0 ? yellow(info.unstaged.length + " files") : green("clean")}`);
  console.log(`  Untracked:  ${info.untracked.length > 0 ? yellow(info.untracked.length + " files") : green("none")}`);

  if (info.log) {
    console.log(dim("\n  Recent commits:"));
    info.log.split("\n").forEach((l) => console.log(dim(`    ${l}`)));
  }
  console.log("");
}

// ─── Smart Commit ─────────────────────────────────────────────────────
async function smartCommit(info) {
  // Show what can be committed
  const allFiles = [...info.unstaged, ...info.untracked];

  if (allFiles.length === 0 && info.staged.length === 0) {
    console.log(green("  Nothing to commit — working tree clean."));
    return;
  }

  // Let user pick files to stage
  if (allFiles.length > 0) {
    const { filesToAdd } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "filesToAdd",
        message: "Select files to stage:",
        choices: allFiles.map((f) => ({
          name: f,
          checked: !f.includes("node_modules") && !f.includes(".env"),
        })),
      },
    ]);

    if (filesToAdd.length > 0) {
      filesToAdd.forEach((f) => run(`git add "${f}"`));
      console.log(green(`  Staged ${filesToAdd.length} file(s).`));
    }
  }

  // Analyze diff for smart message suggestion
  const diff = run("git diff --cached --stat", { safe: true });
  const diffContent = run("git diff --cached --name-only", { safe: true });
  const changedFiles = diffContent.split("\n").filter(Boolean);

  if (changedFiles.length === 0) {
    console.log(yellow("  No staged changes to commit."));
    return;
  }

  // Generate smart commit message suggestion
  const suggestion = generateCommitSuggestion(changedFiles);

  const { commitType } = await inquirer.prompt([
    {
      type: "list",
      name: "commitType",
      message: "Commit type:",
      choices: [
        { name: "feat     — New feature", value: "feat" },
        { name: "fix      — Bug fix", value: "fix" },
        { name: "docs     — Documentation", value: "docs" },
        { name: "style    — Formatting", value: "style" },
        { name: "refactor — Code restructuring", value: "refactor" },
        { name: "test     — Adding tests", value: "test" },
        { name: "chore    — Maintenance", value: "chore" },
      ],
    },
  ]);

  const { scope } = await inquirer.prompt([
    {
      type: "input",
      name: "scope",
      message: "Scope (optional, press Enter to skip):",
      default: suggestion.scope,
    },
  ]);

  const { message } = await inquirer.prompt([
    {
      type: "input",
      name: "message",
      message: "Commit message:",
      default: suggestion.message,
      validate: (v) => (v.trim() ? true : "Message required"),
    },
  ]);

  const scopePart = scope ? `(${scope})` : "";
  const fullMessage = `${commitType}${scopePart}: ${message}`;

  console.log(dim(`\n  Committing: ${fullMessage}`));
  const result = run(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, { safe: true });
  console.log(green(`\n  ${result.split("\n")[0]}`));
}

function generateCommitSuggestion(files) {
  const extensions = files.map((f) => f.split(".").pop());
  const dirs = files.map((f) => f.split("/")[0]);
  const uniqueDirs = [...new Set(dirs)];

  let scope = uniqueDirs.length === 1 ? uniqueDirs[0] : "";
  let message = "";

  if (files.every((f) => f.endsWith(".md"))) {
    message = "update documentation";
    scope = scope || "docs";
  } else if (files.every((f) => f.includes("test") || f.includes("spec"))) {
    message = "update tests";
    scope = scope || "tests";
  } else if (files.length === 1) {
    message = `update ${files[0].split("/").pop()}`;
  } else {
    message = `update ${files.length} files`;
  }

  return { scope, message };
}

// ─── Smart Branch ─────────────────────────────────────────────────────
async function smartBranch(info) {
  const branches = run("git branch --list").split("\n").map((b) => b.trim().replace("* ", ""));

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Branch action:",
      choices: [
        { name: "Create new branch", value: "create" },
        { name: "Switch branch", value: "switch" },
        { name: "Delete branch", value: "delete" },
        { name: "View all branches", value: "view" },
      ],
    },
  ]);

  if (action === "create") {
    const { branchType } = await inquirer.prompt([
      {
        type: "list",
        name: "branchType",
        message: "Branch type:",
        choices: [
          { name: "feature/  — New feature", value: "feature" },
          { name: "fix/      — Bug fix", value: "fix" },
          { name: "hotfix/   — Urgent fix", value: "hotfix" },
          { name: "release/  — Release prep", value: "release" },
          { name: "chore/    — Maintenance", value: "chore" },
        ],
      },
    ]);

    const { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Branch name (kebab-case):",
        validate: (v) => (v.trim() ? true : "Name required"),
        filter: (v) => v.toLowerCase().replace(/\s+/g, "-"),
      },
    ]);

    const fullName = `${branchType}/${name}`;
    run(`git checkout -b "${fullName}"`);
    console.log(green(`\n  Created and switched to: ${fullName}`));
  } else if (action === "switch") {
    const { target } = await inquirer.prompt([
      {
        type: "list",
        name: "target",
        message: "Switch to:",
        choices: branches,
      },
    ]);
    run(`git checkout "${target}"`);
    console.log(green(`\n  Switched to: ${target}`));
  } else if (action === "delete") {
    const safeBranches = branches.filter((b) => b !== info.branch && b !== "main" && b !== "master");
    if (safeBranches.length === 0) {
      console.log(yellow("  No branches available for deletion."));
      return;
    }
    const { target } = await inquirer.prompt([
      {
        type: "list",
        name: "target",
        message: "Delete branch:",
        choices: safeBranches,
      },
    ]);
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Are you sure you want to delete '${target}'?`,
        default: false,
      },
    ]);
    if (confirm) {
      run(`git branch -d "${target}"`, { safe: true });
      console.log(green(`\n  Deleted: ${target}`));
    }
  } else {
    console.log(bold("\n  Branches:"));
    branches.forEach((b) =>
      console.log(`    ${b === info.branch ? green("* " + b) : "  " + b}`)
    );
  }
}

// ─── Smart Push/Pull ──────────────────────────────────────────────────
async function smartSync(info) {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Sync action:",
      choices: [
        { name: "Push to remote", value: "push" },
        { name: "Pull from remote", value: "pull" },
        { name: "Fetch updates", value: "fetch" },
      ],
    },
  ]);

  if (action === "push") {
    const cmd =
      info.hasUpstream === "none"
        ? `git push -u origin ${info.branch}`
        : `git push`;

    console.log(dim(`  Running: ${cmd}`));
    const result = run(cmd, { safe: true });
    console.log(green(`\n  Push complete.`));
    if (result) console.log(dim(`  ${result}`));
  } else if (action === "pull") {
    console.log(dim(`  Running: git pull origin ${info.branch}`));
    const result = run(`git pull origin ${info.branch}`, { safe: true });
    console.log(green(`\n  Pull complete.`));
    if (result) console.log(dim(`  ${result}`));
  } else {
    console.log(dim("  Running: git fetch --all"));
    run("git fetch --all", { safe: true });
    console.log(green("\n  Fetch complete."));
  }
}

// ─── Smart PR ─────────────────────────────────────────────────────────
async function smartPR(info) {
  // Check if gh is available
  try {
    run("which gh");
  } catch {
    console.log(red("  GitHub CLI (gh) is not installed."));
    console.log(dim("  Install it: https://cli.github.com"));
    return;
  }

  const { title } = await inquirer.prompt([
    {
      type: "input",
      name: "title",
      message: "PR title:",
      validate: (v) => (v.trim() ? true : "Title required"),
    },
  ]);

  const { description } = await inquirer.prompt([
    {
      type: "editor",
      name: "description",
      message: "PR description (opens editor):",
      default: `## Summary\n\n- \n\n## Test Plan\n\n- [ ] `,
    },
  ]);

  const { base } = await inquirer.prompt([
    {
      type: "input",
      name: "base",
      message: "Base branch:",
      default: "main",
    },
  ]);

  console.log(dim(`\n  Creating PR: ${title}`));
  const result = run(
    `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${description.replace(/"/g, '\\"')}" --base "${base}"`,
    { safe: true }
  );
  console.log(green(`\n  ${result}`));
}

// ─── Main Menu ────────────────────────────────────────────────────────
async function main() {
  banner();

  let running = true;

  while (running) {
    const info = analyzeRepo();
    showStatus(info);

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What do you want to do?",
        choices: [
          { name: "📝  Smart Commit    — stage, message & commit", value: "commit" },
          { name: "🌿  Smart Branch    — create, switch, delete", value: "branch" },
          { name: "🔄  Smart Sync      — push, pull, fetch", value: "sync" },
          { name: "🔀  Smart PR        — create pull request", value: "pr" },
          { name: "📊  Refresh Status  — show current state", value: "status" },
          { name: "👋  Exit", value: "exit" },
        ],
      },
    ]);

    switch (action) {
      case "commit":
        await smartCommit(info);
        break;
      case "branch":
        await smartBranch(info);
        break;
      case "sync":
        await smartSync(info);
        break;
      case "pr":
        await smartPR(info);
        break;
      case "status":
        break; // Will refresh at top of loop
      case "exit":
        running = false;
        console.log(green("\n  Bye!\n"));
        break;
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
