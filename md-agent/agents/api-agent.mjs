#!/usr/bin/env node

import inquirer from "inquirer";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

// ─── Helpers ──────────────────────────────────────────────────────────
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function banner() {
  console.log("");
  console.log(cyan("  ╔══════════════════════════════════════════╗"));
  console.log(cyan("  ║") + bold("      API Agent — Endpoint Generator      ") + cyan("║"));
  console.log(cyan("  ╚══════════════════════════════════════════╝"));
  console.log(dim("  Generate API routes, controllers, and validation.\n"));
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}

function toCamelCase(str) {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));
}

function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

// ─── Templates: Next.js App Router ────────────────────────────────────
function generateNextRoute(resource, methods, fields) {
  const handlers = [];

  if (methods.includes("GET")) {
    handlers.push(`export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch ${resource} from database
    const data: ${toPascalCase(resource)}[] = [];

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch ${resource}" },
      { status: 500 }
    );
  }
}`);
  }

  if (methods.includes("POST")) {
    handlers.push(`export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Validate and create ${resource}
    const { ${fields.map((f) => f.name).join(", ")} } = body;

    return NextResponse.json(
      { message: "${toPascalCase(resource)} created successfully" },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create ${resource}" },
      { status: 500 }
    );
  }
}`);
  }

  const typeInterface = `interface ${toPascalCase(resource)} {\n  id: string;\n${fields.map((f) => `  ${f.name}: ${f.type};`).join("\n")}\n  createdAt: Date;\n  updatedAt: Date;\n}\n`;

  return `import { NextRequest, NextResponse } from "next/server";

${typeInterface}
${handlers.join("\n\n")}
`;
}

function generateNextDynamicRoute(resource, methods, fields) {
  const handlers = [];
  const paramType = `{ params: { id: string } }`;

  if (methods.includes("GET_BY_ID")) {
    handlers.push(`export async function GET(
  request: NextRequest,
  ${paramType}
) {
  const { id } = params;

  try {
    // TODO: Fetch single ${resource} by id
    return NextResponse.json({ data: null });
  } catch (error) {
    return NextResponse.json(
      { error: "${toPascalCase(resource)} not found" },
      { status: 404 }
    );
  }
}`);
  }

  if (methods.includes("PUT")) {
    handlers.push(`export async function PUT(
  request: NextRequest,
  ${paramType}
) {
  const { id } = params;

  try {
    const body = await request.json();
    const { ${fields.map((f) => f.name).join(", ")} } = body;

    // TODO: Update ${resource} by id
    return NextResponse.json({ message: "${toPascalCase(resource)} updated successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update ${resource}" },
      { status: 500 }
    );
  }
}`);
  }

  if (methods.includes("DELETE")) {
    handlers.push(`export async function DELETE(
  request: NextRequest,
  ${paramType}
) {
  const { id } = params;

  try {
    // TODO: Delete ${resource} by id
    return NextResponse.json({ message: "${toPascalCase(resource)} deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete ${resource}" },
      { status: 500 }
    );
  }
}`);
  }

  return `import { NextRequest, NextResponse } from "next/server";

${handlers.join("\n\n")}
`;
}

// ─── Templates: Express ───────────────────────────────────────────────
function generateExpressRouter(resource, methods, fields) {
  const routes = [];

  if (methods.includes("GET")) {
    routes.push(`router.get("/", async (req: Request, res: Response) => {
  try {
    // TODO: Fetch all ${resource}
    const data: ${toPascalCase(resource)}[] = [];
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ${resource}" });
  }
});`);
  }

  if (methods.includes("GET_BY_ID")) {
    routes.push(`router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Fetch ${resource} by id
    res.json({ data: null });
  } catch (error) {
    res.status(404).json({ error: "${toPascalCase(resource)} not found" });
  }
});`);
  }

  if (methods.includes("POST")) {
    routes.push(`router.post("/", async (req: Request, res: Response) => {
  try {
    const { ${fields.map((f) => f.name).join(", ")} } = req.body;
    // TODO: Create ${resource}
    res.status(201).json({ message: "${toPascalCase(resource)} created" });
  } catch (error) {
    res.status(500).json({ error: "Failed to create ${resource}" });
  }
});`);
  }

  if (methods.includes("PUT")) {
    routes.push(`router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ${fields.map((f) => f.name).join(", ")} } = req.body;
    // TODO: Update ${resource}
    res.json({ message: "${toPascalCase(resource)} updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update ${resource}" });
  }
});`);
  }

  if (methods.includes("DELETE")) {
    routes.push(`router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Delete ${resource}
    res.json({ message: "${toPascalCase(resource)} deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete ${resource}" });
  }
});`);
  }

  const typeInterface = `interface ${toPascalCase(resource)} {\n  id: string;\n${fields.map((f) => `  ${f.name}: ${f.type};`).join("\n")}\n  createdAt: Date;\n  updatedAt: Date;\n}\n`;

  return `import { Router, Request, Response } from "express";

const router = Router();

${typeInterface}
${routes.join("\n\n")}

export default router;
`;
}

// ─── Templates: Zod Validation ────────────────────────────────────────
function generateZodSchema(resource, fields) {
  const zodTypes = {
    string: "z.string()",
    number: "z.number()",
    boolean: "z.boolean()",
    Date: "z.string().datetime()",
  };

  const zodFields = fields
    .map((f) => {
      const base = zodTypes[f.type] || "z.string()";
      return `  ${f.name}: ${f.optional ? `${base}.optional()` : base}`;
    })
    .join(",\n");

  return `import { z } from "zod";

export const create${toPascalCase(resource)}Schema = z.object({
${zodFields},
});

export const update${toPascalCase(resource)}Schema = create${toPascalCase(resource)}Schema.partial();

export type Create${toPascalCase(resource)}Input = z.infer<typeof create${toPascalCase(resource)}Schema>;
export type Update${toPascalCase(resource)}Input = z.infer<typeof update${toPascalCase(resource)}Schema>;
`;
}

// ─── Question Flow ────────────────────────────────────────────────────
async function main() {
  banner();

  let running = true;

  while (running) {
    const { framework } = await inquirer.prompt([
      {
        type: "list",
        name: "framework",
        message: "API framework:",
        choices: [
          { name: "Next.js App Router  — /app/api routes", value: "nextjs" },
          { name: "Express             — Router + Controllers", value: "express" },
        ],
      },
    ]);

    const { resource } = await inquirer.prompt([
      {
        type: "input",
        name: "resource",
        message: "Resource name (e.g., users, products):",
        validate: (v) => (v.trim() ? true : "Required"),
        filter: (v) => v.toLowerCase().replace(/\s+/g, "-"),
      },
    ]);

    const { methods } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "methods",
        message: "Which endpoints?",
        choices: [
          { name: "GET      — List all", value: "GET", checked: true },
          { name: "GET/:id  — Get by ID", value: "GET_BY_ID", checked: true },
          { name: "POST     — Create", value: "POST", checked: true },
          { name: "PUT/:id  — Update", value: "PUT", checked: true },
          { name: "DELETE   — Delete", value: "DELETE", checked: true },
        ],
      },
    ]);

    // Fields
    console.log(yellow("\n  Define resource fields:"));
    const fields = [];
    let addMore = true;

    while (addMore) {
      const { name, type, optional, more } = await inquirer.prompt([
        { type: "input", name: "name", message: "Field name:", validate: (v) => (v.trim() ? true : "Required") },
        {
          type: "list",
          name: "type",
          message: "Field type:",
          choices: ["string", "number", "boolean", "Date", "Custom"],
        },
        { type: "confirm", name: "optional", message: "Optional?", default: false },
        { type: "confirm", name: "more", message: "Add another field?", default: true },
      ]);

      let finalType = type;
      if (type === "Custom") {
        const { custom } = await inquirer.prompt([
          { type: "input", name: "custom", message: "Custom type:" },
        ]);
        finalType = custom;
      }

      fields.push({ name, type: finalType, optional });
      addMore = more;
    }

    // Extras
    const { extras } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "extras",
        message: "Generate extras?",
        choices: [
          { name: "Zod validation schema", value: "zod", checked: true },
        ],
      },
    ]);

    const { outputDir } = await inquirer.prompt([
      {
        type: "input",
        name: "outputDir",
        message: "Output directory:",
        default: framework === "nextjs" ? `./app/api/${resource}` : `./src/routes`,
      },
    ]);

    // Generate
    const dir = resolve(outputDir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    console.log(yellow("\n  Generating files...\n"));

    if (framework === "nextjs") {
      // Collection route: /api/resource
      const collectionMethods = methods.filter((m) => m === "GET" || m === "POST");
      if (collectionMethods.length > 0) {
        writeFileSync(
          join(dir, "route.ts"),
          generateNextRoute(resource, collectionMethods, fields),
          "utf-8"
        );
        console.log(green(`  ✓ ${resource}/route.ts`));
      }

      // Dynamic route: /api/resource/[id]
      const dynamicMethods = methods.filter((m) => m === "GET_BY_ID" || m === "PUT" || m === "DELETE");
      if (dynamicMethods.length > 0) {
        const dynamicDir = join(dir, "[id]");
        if (!existsSync(dynamicDir)) mkdirSync(dynamicDir, { recursive: true });
        writeFileSync(
          join(dynamicDir, "route.ts"),
          generateNextDynamicRoute(resource, dynamicMethods, fields),
          "utf-8"
        );
        console.log(green(`  ✓ ${resource}/[id]/route.ts`));
      }
    } else {
      // Express router
      writeFileSync(
        join(dir, `${resource}.routes.ts`),
        generateExpressRouter(resource, methods, fields),
        "utf-8"
      );
      console.log(green(`  ✓ ${resource}.routes.ts`));
    }

    // Zod schema
    if (extras.includes("zod")) {
      const schemaDir = framework === "nextjs" ? resolve("./lib/validations") : resolve("./src/validations");
      if (!existsSync(schemaDir)) mkdirSync(schemaDir, { recursive: true });
      writeFileSync(
        join(schemaDir, `${resource}.schema.ts`),
        generateZodSchema(resource, fields),
        "utf-8"
      );
      console.log(green(`  ✓ ${resource}.schema.ts`));
    }

    console.log(green(`\n  API for '${resource}' created!\n`));

    const { more } = await inquirer.prompt([
      { type: "confirm", name: "more", message: "Create another API resource?", default: false },
    ]);
    running = more;
  }

  console.log(green("\n  Done!\n"));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
