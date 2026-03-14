#!/usr/bin/env node

import inquirer from "inquirer";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { generateClaudeMd } from "./templates/claude-md.mjs";
import { generateReadmeMd } from "./templates/readme-md.mjs";
import { generateContributingMd } from "./templates/contributing-md.mjs";

// ─── Preset Tech Stacks ───────────────────────────────────────────────
const PRESETS = {
  "Next.js + Tailwind + ShadCN": {
    techStack: ["TypeScript", "Next.js", "Tailwind CSS", "ShadCN UI"],
    folders: [
      { name: "app", description: "Next.js App Router pages and layouts" },
      { name: "components", description: "Reusable React components" },
      { name: "lib", description: "Utility functions and shared logic" },
      { name: "styles", description: "Global styles and design tokens" },
      { name: "public", description: "Static assets" },
    ],
    codingRules: [
      "Use functional React components (no class components)",
      "Prefer server components over client components",
      "Use Tailwind utility classes instead of custom CSS",
      "Use TypeScript strict mode — avoid `any` types",
      "Name files in kebab-case (e.g., `user-profile.tsx`)",
      "Name components in PascalCase (e.g., `UserProfile`)",
    ],
    designRules: [
      "Follow ShadCN component patterns and conventions",
      "Use design tokens from `/styles/tokens.ts`",
      "Prefer ShadCN primitives over custom UI components",
    ],
    patterns: [
      {
        name: "App Router",
        description: "Use Next.js App Router (`/app`) for routing and layouts",
      },
      {
        name: "Server Components",
        description:
          'Default to React Server Components; use `"use client"` only when needed',
      },
      {
        name: "Colocation",
        description:
          "Keep components, hooks, and utils close to where they are used",
      },
    ],
    commands: [
      { cmd: "npm run dev", description: "Start development server" },
      { cmd: "npm run build", description: "Production build" },
      { cmd: "npm run lint", description: "Run linter" },
      { cmd: "npm run test", description: "Run tests" },
    ],
    installCommand: "npm install",
    prerequisites: ["Node.js >= 18", "npm >= 9"],
  },
  "React + Vite": {
    techStack: ["TypeScript", "React", "Vite", "CSS Modules"],
    folders: [
      { name: "src", description: "Application source code" },
      { name: "src/components", description: "Reusable React components" },
      { name: "src/hooks", description: "Custom React hooks" },
      { name: "src/utils", description: "Utility functions" },
      { name: "public", description: "Static assets" },
    ],
    codingRules: [
      "Use functional React components with hooks",
      "Use TypeScript strict mode",
      "Use CSS Modules for component styling",
      "Name files in kebab-case",
    ],
    designRules: [
      "Keep a consistent design token system",
      "Use CSS variables for theming",
    ],
    patterns: [
      {
        name: "Component-driven",
        description: "Build UI from small, reusable components",
      },
      {
        name: "Custom Hooks",
        description: "Extract reusable logic into custom hooks",
      },
    ],
    commands: [
      { cmd: "npm run dev", description: "Start Vite dev server" },
      { cmd: "npm run build", description: "Production build" },
      { cmd: "npm run preview", description: "Preview production build" },
      { cmd: "npm run lint", description: "Run ESLint" },
    ],
    installCommand: "npm install",
    prerequisites: ["Node.js >= 18"],
  },
  "Express API": {
    techStack: ["TypeScript", "Express", "Prisma", "PostgreSQL"],
    folders: [
      { name: "src", description: "Application source code" },
      { name: "src/routes", description: "API route handlers" },
      { name: "src/middleware", description: "Express middleware" },
      { name: "src/services", description: "Business logic layer" },
      { name: "prisma", description: "Database schema and migrations" },
    ],
    codingRules: [
      "Use async/await for all async operations",
      "Validate all request inputs with Zod",
      "Keep route handlers thin — logic goes in services",
      "Use TypeScript strict mode",
    ],
    designRules: [
      "Follow REST API naming conventions",
      "Return consistent JSON error responses",
    ],
    patterns: [
      {
        name: "Layered Architecture",
        description: "Routes → Services → Database",
      },
      {
        name: "Middleware",
        description: "Use middleware for auth, validation, and error handling",
      },
    ],
    commands: [
      { cmd: "npm run dev", description: "Start with hot reload" },
      { cmd: "npm run build", description: "Compile TypeScript" },
      { cmd: "npm run start", description: "Start production server" },
      { cmd: "npm run db:migrate", description: "Run database migrations" },
    ],
    installCommand: "npm install",
    prerequisites: ["Node.js >= 18", "PostgreSQL >= 14"],
  },
  "Python + FastAPI": {
    techStack: ["Python", "FastAPI", "SQLAlchemy", "PostgreSQL"],
    folders: [
      { name: "app", description: "Application source code" },
      { name: "app/routers", description: "API route handlers" },
      { name: "app/models", description: "Database models" },
      { name: "app/schemas", description: "Pydantic schemas" },
      { name: "app/services", description: "Business logic" },
      { name: "tests", description: "Test files" },
    ],
    codingRules: [
      "Use type hints everywhere",
      "Use async endpoints for I/O operations",
      "Validate inputs with Pydantic models",
      "Follow PEP 8 naming conventions",
    ],
    designRules: [
      "Follow REST API naming conventions",
      "Use Pydantic for all request/response schemas",
    ],
    patterns: [
      {
        name: "Dependency Injection",
        description: "Use FastAPI's Depends() for shared logic",
      },
      {
        name: "Repository Pattern",
        description: "Abstract database access behind repositories",
      },
    ],
    commands: [
      { cmd: "uvicorn app.main:app --reload", description: "Start dev server" },
      { cmd: "pytest", description: "Run tests" },
      { cmd: "ruff check .", description: "Run linter" },
      { cmd: "alembic upgrade head", description: "Run migrations" },
    ],
    installCommand: "pip install -r requirements.txt",
    prerequisites: ["Python >= 3.11", "PostgreSQL >= 14"],
  },
};

// ─── Color Helpers ────────────────────────────────────────────────────
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function banner() {
  console.log("");
  console.log(cyan("  ╔══════════════════════════════════════════╗"));
  console.log(cyan("  ║") + bold("     MD Agent — Project File Generator    ") + cyan("║"));
  console.log(cyan("  ╚══════════════════════════════════════════╝"));
  console.log(dim("  Answer the questions to generate your project files.\n"));
}

// ─── Question Flow ────────────────────────────────────────────────────
async function askBasicInfo() {
  return inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "What is the project name?",
      validate: (v) => (v.trim() ? true : "Project name is required"),
    },
    {
      type: "input",
      name: "projectDescription",
      message: "Short project description:",
      validate: (v) => (v.trim() ? true : "Description is required"),
    },
    {
      type: "list",
      name: "preset",
      message: "Choose a tech stack preset (or custom):",
      choices: [...Object.keys(PRESETS), "Custom — I will define everything"],
    },
  ]);
}

async function askCustomTechStack() {
  const { techInput } = await inquirer.prompt([
    {
      type: "input",
      name: "techInput",
      message: "List your technologies (comma-separated):",
      validate: (v) => (v.trim() ? true : "At least one technology required"),
    },
  ]);
  return techInput.split(",").map((t) => t.trim());
}

async function askFolders() {
  const folders = [];
  let addMore = true;

  console.log(yellow("\n  Define your project folder structure:"));

  while (addMore) {
    const { name, description, more } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Folder name:",
        validate: (v) => (v.trim() ? true : "Required"),
      },
      {
        type: "input",
        name: "description",
        message: "Folder description:",
        validate: (v) => (v.trim() ? true : "Required"),
      },
      {
        type: "confirm",
        name: "more",
        message: "Add another folder?",
        default: true,
      },
    ]);
    folders.push({ name, description });
    addMore = more;
  }
  return folders;
}

async function askCodingRules() {
  const rules = [];
  let addMore = true;

  console.log(yellow("\n  Define your coding rules:"));

  while (addMore) {
    const { rule, more } = await inquirer.prompt([
      { type: "input", name: "rule", message: "Coding rule:" },
      {
        type: "confirm",
        name: "more",
        message: "Add another rule?",
        default: true,
      },
    ]);
    if (rule.trim()) rules.push(rule.trim());
    addMore = more;
  }
  return rules;
}

async function askDesignRules() {
  const rules = [];
  let addMore = true;

  console.log(yellow("\n  Define your design system rules:"));

  while (addMore) {
    const { rule, more } = await inquirer.prompt([
      { type: "input", name: "rule", message: "Design rule:" },
      {
        type: "confirm",
        name: "more",
        message: "Add another rule?",
        default: false,
      },
    ]);
    if (rule.trim()) rules.push(rule.trim());
    addMore = more;
  }
  return rules;
}

async function askPatterns() {
  const patterns = [];
  let addMore = true;

  console.log(yellow("\n  Define key architecture patterns:"));

  while (addMore) {
    const { name, description, more } = await inquirer.prompt([
      { type: "input", name: "name", message: "Pattern name:" },
      { type: "input", name: "description", message: "Pattern description:" },
      {
        type: "confirm",
        name: "more",
        message: "Add another pattern?",
        default: false,
      },
    ]);
    if (name.trim()) patterns.push({ name: name.trim(), description: description.trim() });
    addMore = more;
  }
  return patterns;
}

async function askCommands() {
  const commands = [];
  let addMore = true;

  console.log(yellow("\n  Define your project commands:"));

  while (addMore) {
    const { cmd, description, more } = await inquirer.prompt([
      {
        type: "input",
        name: "cmd",
        message: "Command (e.g., npm run dev):",
      },
      { type: "input", name: "description", message: "What does it do?" },
      {
        type: "confirm",
        name: "more",
        message: "Add another command?",
        default: true,
      },
    ]);
    if (cmd.trim()) commands.push({ cmd: cmd.trim(), description: description.trim() });
    addMore = more;
  }
  return commands;
}

async function askOutputOptions() {
  return inquirer.prompt([
    {
      type: "checkbox",
      name: "files",
      message: "Which files do you want to generate?",
      choices: [
        { name: "CLAUDE.md", value: "claude", checked: true },
        { name: "README.md", value: "readme", checked: true },
        { name: "CONTRIBUTING.md", value: "contributing", checked: false },
      ],
    },
    {
      type: "input",
      name: "outputDir",
      message: "Output directory (absolute or relative path):",
      default: process.cwd(),
    },
    {
      type: "input",
      name: "license",
      message: "License type:",
      default: "MIT",
    },
    {
      type: "input",
      name: "contributingNotes",
      message: "Contributing notes (optional, press Enter to skip):",
      default: "",
    },
  ]);
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  banner();

  // Step 1: Basic info & preset
  const basicInfo = await askBasicInfo();
  let answers;

  if (basicInfo.preset === "Custom — I will define everything") {
    // Full custom flow
    const techStack = await askCustomTechStack();
    const folders = await askFolders();
    const codingRules = await askCodingRules();
    const designRules = await askDesignRules();
    const patterns = await askPatterns();
    const commands = await askCommands();

    const { installCommand, prerequisites } = await inquirer.prompt([
      {
        type: "input",
        name: "installCommand",
        message: "Install command:",
        default: "npm install",
      },
      {
        type: "input",
        name: "prerequisites",
        message: "Prerequisites (comma-separated):",
        default: "Node.js >= 18",
      },
    ]);

    answers = {
      ...basicInfo,
      techStack,
      folders,
      codingRules,
      designRules,
      patterns,
      commands,
      installCommand,
      prerequisites: prerequisites.split(",").map((p) => p.trim()),
    };
  } else {
    // Use preset and let user customize
    const preset = PRESETS[basicInfo.preset];
    console.log(
      green(`\n  Using preset: ${basicInfo.preset}`)
    );

    const { wantCustomize } = await inquirer.prompt([
      {
        type: "confirm",
        name: "wantCustomize",
        message: "Do you want to customize the preset values?",
        default: false,
      },
    ]);

    if (wantCustomize) {
      const { editSections } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "editSections",
          message: "Which sections do you want to edit?",
          choices: [
            { name: "Folder structure", value: "folders" },
            { name: "Coding rules", value: "codingRules" },
            { name: "Design rules", value: "designRules" },
            { name: "Architecture patterns", value: "patterns" },
            { name: "Commands", value: "commands" },
          ],
        },
      ]);

      const customized = { ...preset };
      if (editSections.includes("folders"))
        customized.folders = await askFolders();
      if (editSections.includes("codingRules"))
        customized.codingRules = await askCodingRules();
      if (editSections.includes("designRules"))
        customized.designRules = await askDesignRules();
      if (editSections.includes("patterns"))
        customized.patterns = await askPatterns();
      if (editSections.includes("commands"))
        customized.commands = await askCommands();

      answers = { ...basicInfo, ...customized };
    } else {
      answers = { ...basicInfo, ...preset };
    }
  }

  // Step 2: Output options
  const outputOptions = await askOutputOptions();
  answers = { ...answers, ...outputOptions };

  // Step 3: Generate files
  const outputDir = resolve(outputOptions.outputDir);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(yellow("\n  Generating files...\n"));

  const generated = [];

  if (outputOptions.files.includes("claude")) {
    const content = generateClaudeMd(answers);
    const filePath = join(outputDir, "CLAUDE.md");
    writeFileSync(filePath, content, "utf-8");
    generated.push(filePath);
    console.log(green(`  ✓ CLAUDE.md`));
  }

  if (outputOptions.files.includes("readme")) {
    const content = generateReadmeMd(answers);
    const filePath = join(outputDir, "README.md");
    writeFileSync(filePath, content, "utf-8");
    generated.push(filePath);
    console.log(green(`  ✓ README.md`));
  }

  if (outputOptions.files.includes("contributing")) {
    const content = generateContributingMd(answers);
    const filePath = join(outputDir, "CONTRIBUTING.md");
    writeFileSync(filePath, content, "utf-8");
    generated.push(filePath);
    console.log(green(`  ✓ CONTRIBUTING.md`));
  }

  console.log(
    `\n${green("  Done!")} Generated ${generated.length} file(s) in ${dim(outputDir)}\n`
  );
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
