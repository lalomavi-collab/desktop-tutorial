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
  console.log(cyan("  ║") + bold("   Component Agent — React Generator      ") + cyan("║"));
  console.log(cyan("  ╚══════════════════════════════════════════╝"));
  console.log(dim("  Generate React/Next.js components with best practices.\n"));
}

function toPascalCase(str) {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

// ─── Component Templates ──────────────────────────────────────────────
function generateServerComponent(name, props, description) {
  const propsInterface = props.length > 0
    ? `\ninterface ${name}Props {\n${props.map((p) => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`).join("\n")}\n}\n`
    : "";

  const propsParam = props.length > 0 ? `{ ${props.map((p) => p.name).join(", ")} }: ${name}Props` : "";

  return `${propsInterface}
export default function ${name}(${propsParam}) {
  return (
    <div className="">
      {/* ${description || name} */}
    </div>
  );
}
`;
}

function generateClientComponent(name, props, description, hooks) {
  const propsInterface = props.length > 0
    ? `\ninterface ${name}Props {\n${props.map((p) => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`).join("\n")}\n}\n`
    : "";

  const propsParam = props.length > 0 ? `{ ${props.map((p) => p.name).join(", ")} }: ${name}Props` : "";

  const hookImports = [];
  const hookCode = [];

  if (hooks.includes("useState")) {
    hookImports.push("useState");
    hookCode.push("  const [value, setValue] = useState<string>(\"\");");
  }
  if (hooks.includes("useEffect")) {
    hookImports.push("useEffect");
    hookCode.push("");
    hookCode.push("  useEffect(() => {");
    hookCode.push("    // Side effect logic");
    hookCode.push("  }, []);");
  }
  if (hooks.includes("useRef")) {
    hookImports.push("useRef");
    hookCode.push("  const ref = useRef<HTMLDivElement>(null);");
  }
  if (hooks.includes("useMemo")) {
    hookImports.push("useMemo");
    hookCode.push("");
    hookCode.push("  const computed = useMemo(() => {");
    hookCode.push("    // Expensive computation");
    hookCode.push("    return null;");
    hookCode.push("  }, []);");
  }

  const reactImport = hookImports.length > 0
    ? `import { ${hookImports.join(", ")} } from "react";\n`
    : "";

  return `"use client";

${reactImport}${propsInterface}
export default function ${name}(${propsParam}) {
${hookCode.join("\n")}

  return (
    <div className="">
      {/* ${description || name} */}
    </div>
  );
}
`;
}

function generateShadcnComponent(name, props, description, shadcnParts) {
  const propsInterface = props.length > 0
    ? `\ninterface ${name}Props {\n${props.map((p) => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`).join("\n")}\n}\n`
    : "";

  const propsParam = props.length > 0 ? `{ ${props.map((p) => p.name).join(", ")} }: ${name}Props` : "";

  const imports = [];

  if (shadcnParts.includes("Button")) {
    imports.push('import { Button } from "@/components/ui/button";');
  }
  if (shadcnParts.includes("Card")) {
    imports.push('import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";');
  }
  if (shadcnParts.includes("Input")) {
    imports.push('import { Input } from "@/components/ui/input";');
  }
  if (shadcnParts.includes("Dialog")) {
    imports.push('import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";');
  }
  if (shadcnParts.includes("Form")) {
    imports.push('import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";');
  }

  const importsStr = imports.length > 0 ? imports.join("\n") + "\n" : "";

  return `"use client";

${importsStr}${propsInterface}
export default function ${name}(${propsParam}) {
  return (
    <div className="">
      {/* ${description || name} */}
    </div>
  );
}
`;
}

function generateStoryFile(name, fileName) {
  return `import type { Meta, StoryObj } from "@storybook/react";
import ${name} from "./${fileName}";

const meta: Meta<typeof ${name}> = {
  title: "Components/${name}",
  component: ${name},
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ${name}>;

export const Default: Story = {
  args: {},
};
`;
}

function generateTestFile(name, fileName) {
  return `import { render, screen } from "@testing-library/react";
import ${name} from "./${fileName}";

describe("${name}", () => {
  it("renders without crashing", () => {
    render(<${name} />);
  });
});
`;
}

// ─── Question Flow ────────────────────────────────────────────────────
async function main() {
  banner();

  let running = true;

  while (running) {
    const { componentName } = await inquirer.prompt([
      {
        type: "input",
        name: "componentName",
        message: "Component name (PascalCase):",
        validate: (v) => (v.trim() ? true : "Name required"),
        filter: (v) => toPascalCase(v),
      },
    ]);

    const { description } = await inquirer.prompt([
      {
        type: "input",
        name: "description",
        message: "Short description:",
        default: `${componentName} component`,
      },
    ]);

    const { componentType } = await inquirer.prompt([
      {
        type: "list",
        name: "componentType",
        message: "Component type:",
        choices: [
          { name: "Server Component  — default, no client JS", value: "server" },
          { name: "Client Component  — with hooks & interactivity", value: "client" },
          { name: "ShadCN Component  — using ShadCN UI parts", value: "shadcn" },
        ],
      },
    ]);

    // Props
    const props = [];
    const { hasProps } = await inquirer.prompt([
      { type: "confirm", name: "hasProps", message: "Does it have props?", default: true },
    ]);

    if (hasProps) {
      let addMore = true;
      while (addMore) {
        const { name, type, optional, more } = await inquirer.prompt([
          { type: "input", name: "name", message: "Prop name:" },
          {
            type: "list",
            name: "type",
            message: "Prop type:",
            choices: ["string", "number", "boolean", "React.ReactNode", "() => void", "Custom"],
          },
          { type: "confirm", name: "optional", message: "Optional?", default: false },
          { type: "confirm", name: "more", message: "Add another prop?", default: true },
        ]);

        let finalType = type;
        if (type === "Custom") {
          const { custom } = await inquirer.prompt([
            { type: "input", name: "custom", message: "Custom type:" },
          ]);
          finalType = custom;
        }

        props.push({ name, type: finalType, optional });
        addMore = more;
      }
    }

    // Type-specific options
    let hooks = [];
    let shadcnParts = [];

    if (componentType === "client") {
      const result = await inquirer.prompt([
        {
          type: "checkbox",
          name: "hooks",
          message: "Which hooks?",
          choices: [
            { name: "useState", checked: true },
            { name: "useEffect" },
            { name: "useRef" },
            { name: "useMemo" },
          ],
        },
      ]);
      hooks = result.hooks;
    }

    if (componentType === "shadcn") {
      const result = await inquirer.prompt([
        {
          type: "checkbox",
          name: "parts",
          message: "Which ShadCN components?",
          choices: [
            { name: "Button", checked: true },
            { name: "Card" },
            { name: "Input" },
            { name: "Dialog" },
            { name: "Form" },
          ],
        },
      ]);
      shadcnParts = result.parts;
    }

    // Extra files
    const { extras } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "extras",
        message: "Generate extra files?",
        choices: [
          { name: "Story file (.stories.tsx)", value: "story" },
          { name: "Test file (.test.tsx)", value: "test" },
        ],
      },
    ]);

    // Output directory
    const { outputDir } = await inquirer.prompt([
      {
        type: "input",
        name: "outputDir",
        message: "Output directory:",
        default: `./components/${toKebabCase(componentName)}`,
      },
    ]);

    // Generate files
    const dir = resolve(outputDir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const fileName = toKebabCase(componentName);

    let componentCode;
    switch (componentType) {
      case "server":
        componentCode = generateServerComponent(componentName, props, description);
        break;
      case "client":
        componentCode = generateClientComponent(componentName, props, description, hooks);
        break;
      case "shadcn":
        componentCode = generateShadcnComponent(componentName, props, description, shadcnParts);
        break;
    }

    writeFileSync(join(dir, `${fileName}.tsx`), componentCode, "utf-8");
    console.log(green(`\n  ✓ ${fileName}.tsx`));

    // Index file for clean imports
    writeFileSync(
      join(dir, "index.ts"),
      `export { default } from "./${fileName}";\n`,
      "utf-8"
    );
    console.log(green(`  ✓ index.ts`));

    if (extras.includes("story")) {
      writeFileSync(
        join(dir, `${fileName}.stories.tsx`),
        generateStoryFile(componentName, fileName),
        "utf-8"
      );
      console.log(green(`  ✓ ${fileName}.stories.tsx`));
    }

    if (extras.includes("test")) {
      writeFileSync(
        join(dir, `${fileName}.test.tsx`),
        generateTestFile(componentName, fileName),
        "utf-8"
      );
      console.log(green(`  ✓ ${fileName}.test.tsx`));
    }

    console.log(green(`\n  Component created at: ${dim(dir)}\n`));

    const { more } = await inquirer.prompt([
      { type: "confirm", name: "more", message: "Create another component?", default: false },
    ]);
    running = more;
  }

  console.log(green("\n  Done!\n"));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
