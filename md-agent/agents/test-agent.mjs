#!/usr/bin/env node

import inquirer from "inquirer";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve, basename, dirname, extname } from "path";
import { execSync } from "child_process";

// ─── Helpers ──────────────────────────────────────────────────────────
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function banner() {
  console.log("");
  console.log(cyan("  ╔══════════════════════════════════════════╗"));
  console.log(cyan("  ║") + bold("      Test Agent — Smart Test Generator   ") + cyan("║"));
  console.log(cyan("  ╚══════════════════════════════════════════╝"));
  console.log(dim("  Auto-generate tests for your code files.\n"));
}

function toPascalCase(str) {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^(.)/, (_, c) => c.toUpperCase());
}

// ─── Source File Analysis ─────────────────────────────────────────────
function analyzeSourceFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const fileName = basename(filePath);
  const ext = extname(filePath);

  const analysis = {
    fileName,
    filePath,
    ext,
    isComponent: false,
    isHook: false,
    isUtil: false,
    isApi: false,
    isClient: content.includes('"use client"'),
    exports: [],
    functions: [],
    componentName: null,
  };

  // Detect component
  const componentMatch = content.match(/export\s+(?:default\s+)?function\s+([A-Z]\w+)/);
  if (componentMatch) {
    analysis.isComponent = true;
    analysis.componentName = componentMatch[1];
    analysis.exports.push(componentMatch[1]);
  }

  // Detect hook
  if (fileName.startsWith("use") || content.match(/export\s+function\s+use[A-Z]/)) {
    analysis.isHook = true;
  }

  // Detect API route
  if (content.includes("NextRequest") || content.includes("NextResponse") || content.includes("Router()")) {
    analysis.isApi = true;
  }

  // Detect exported functions
  const funcMatches = content.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g);
  for (const match of funcMatches) {
    if (!analysis.exports.includes(match[1])) {
      analysis.exports.push(match[1]);
    }
    analysis.functions.push(match[1]);
  }

  // Detect exported consts (arrow functions)
  const constMatches = content.matchAll(/export\s+const\s+(\w+)\s*=/g);
  for (const match of constMatches) {
    analysis.exports.push(match[1]);
    analysis.functions.push(match[1]);
  }

  // If not component and not hook and not api, it's utility
  if (!analysis.isComponent && !analysis.isHook && !analysis.isApi) {
    analysis.isUtil = true;
  }

  return analysis;
}

// ─── Test Templates ───────────────────────────────────────────────────
function generateComponentTest(analysis, options) {
  const name = analysis.componentName || toPascalCase(analysis.fileName.replace(analysis.ext, ""));
  const importPath = "./" + analysis.fileName.replace(analysis.ext, "");

  const imports = [`import { render, screen } from "@testing-library/react";`];
  if (options.userEvents) {
    imports.push(`import userEvent from "@testing-library/user-event";`);
  }
  imports.push(`import ${name} from "${importPath}";`);

  const tests = [];

  tests.push(`  it("renders without crashing", () => {
    render(<${name} />);
  });`);

  if (options.snapshot) {
    tests.push(`
  it("matches snapshot", () => {
    const { container } = render(<${name} />);
    expect(container).toMatchSnapshot();
  });`);
  }

  if (options.accessibility) {
    tests.push(`
  it("has no accessibility violations", async () => {
    const { container } = render(<${name} />);
    // TODO: Add axe-core check
    expect(container).toBeTruthy();
  });`);
  }

  if (options.userEvents) {
    tests.push(`
  it("handles user interaction", async () => {
    const user = userEvent.setup();
    render(<${name} />);

    // TODO: Add specific interaction tests
    // await user.click(screen.getByRole("button"));
    // expect(...).toBe(...);
  });`);
  }

  if (options.props && analysis.exports.length > 0) {
    tests.push(`
  it("renders with props correctly", () => {
    // TODO: Add actual props
    render(<${name} />);
    // expect(screen.getByText("...")).toBeInTheDocument();
  });`);
  }

  return `${imports.join("\n")}

describe("${name}", () => {
${tests.join("\n")}
});
`;
}

function generateHookTest(analysis) {
  const hookName = analysis.functions.find((f) => f.startsWith("use")) || analysis.functions[0];
  const importPath = "./" + analysis.fileName.replace(analysis.ext, "");

  return `import { renderHook, act } from "@testing-library/react";
import { ${hookName} } from "${importPath}";

describe("${hookName}", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => ${hookName}());
    // TODO: Assert initial return value
    expect(result.current).toBeDefined();
  });

  it("updates state correctly", () => {
    const { result } = renderHook(() => ${hookName}());

    act(() => {
      // TODO: Trigger state update
    });

    // TODO: Assert updated state
    expect(result.current).toBeDefined();
  });
});
`;
}

function generateApiTest(analysis, options) {
  const importPath = "./" + analysis.fileName.replace(analysis.ext, "");
  const handlers = analysis.functions.filter((f) => ["GET", "POST", "PUT", "DELETE"].includes(f));

  const tests = [];

  for (const method of handlers) {
    tests.push(`  describe("${method}", () => {
    it("returns successful response", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        method: "${method === "GET" ? "GET" : method}",${method !== "GET" ? `\n        body: JSON.stringify({}),` : ""}
      });

      const response = await ${method}(request${["PUT", "DELETE"].includes(method) ? ', { params: { id: "1" } }' : ""});
      const data = await response.json();

      expect(response.status).toBeLessThan(400);
      expect(data).toBeDefined();
    });

    it("handles errors gracefully", async () => {
      // TODO: Mock a failure scenario
      const request = new NextRequest("http://localhost/api/test", {
        method: "${method}",
      });

      const response = await ${method}(request${["PUT", "DELETE"].includes(method) ? ', { params: { id: "invalid" } }' : ""});
      expect(response).toBeDefined();
    });
  });`);
  }

  if (tests.length === 0) {
    tests.push(`  it("should have API tests", () => {
    // TODO: Add tests for API handlers
    expect(true).toBe(true);
  });`);
  }

  return `import { NextRequest } from "next/server";
${handlers.length > 0 ? `import { ${handlers.join(", ")} } from "${importPath}";` : ""}

describe("API: ${analysis.fileName}", () => {
${tests.join("\n\n")}
});
`;
}

function generateUtilTest(analysis) {
  const importPath = "./" + analysis.fileName.replace(analysis.ext, "");
  const funcs = analysis.functions;

  const tests = funcs.map((fn) => `  describe("${fn}", () => {
    it("works with valid input", () => {
      // TODO: Replace with actual test
      const result = ${fn}();
      expect(result).toBeDefined();
    });

    it("handles edge cases", () => {
      // TODO: Test edge cases
      // expect(${fn}(null)).toBe(...);
      // expect(${fn}("")).toBe(...);
    });
  });`);

  if (tests.length === 0) {
    tests.push(`  it("should have tests", () => {
    expect(true).toBe(true);
  });`);
  }

  return `import { ${funcs.join(", ")} } from "${importPath}";

describe("${analysis.fileName.replace(analysis.ext, "")}", () => {
${tests.join("\n\n")}
});
`;
}

// ─── Scan for Testable Files ──────────────────────────────────────────
function findTestableFiles(dir) {
  try {
    const result = execSync(
      `find "${dir}" -type f \\( -name "*.ts" -o -name "*.tsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.stories.*" ! -name "*.d.ts" ! -path "*/node_modules/*" ! -path "*/.next/*" 2>/dev/null | head -30`,
      { encoding: "utf-8" }
    ).trim();
    return result ? result.split("\n") : [];
  } catch {
    return [];
  }
}

// ─── Question Flow ────────────────────────────────────────────────────
async function main() {
  banner();

  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Test generation mode:",
      choices: [
        { name: "Single file   — generate test for one file", value: "single" },
        { name: "Scan project  — find files without tests", value: "scan" },
        { name: "Manual        — create test from scratch", value: "manual" },
      ],
    },
  ]);

  if (mode === "single") {
    const { filePath } = await inquirer.prompt([
      {
        type: "input",
        name: "filePath",
        message: "Path to source file:",
        validate: (v) => existsSync(v) ? true : "File not found",
      },
    ]);

    const analysis = analyzeSourceFile(resolve(filePath));

    console.log(bold("\n  File analysis:"));
    console.log(`  Type: ${analysis.isComponent ? "Component" : analysis.isHook ? "Hook" : analysis.isApi ? "API Route" : "Utility"}`);
    console.log(`  Exports: ${analysis.exports.join(", ") || "none found"}`);
    console.log(`  Functions: ${analysis.functions.join(", ") || "none found"}\n`);

    let testContent;

    if (analysis.isComponent) {
      const options = await inquirer.prompt([
        {
          type: "checkbox",
          name: "features",
          message: "Test features:",
          choices: [
            { name: "Snapshot test", value: "snapshot" },
            { name: "User event tests", value: "userEvents", checked: true },
            { name: "Accessibility check", value: "accessibility" },
            { name: "Props testing", value: "props", checked: true },
          ],
        },
      ]);
      testContent = generateComponentTest(analysis, {
        snapshot: options.features.includes("snapshot"),
        userEvents: options.features.includes("userEvents"),
        accessibility: options.features.includes("accessibility"),
        props: options.features.includes("props"),
      });
    } else if (analysis.isHook) {
      testContent = generateHookTest(analysis);
    } else if (analysis.isApi) {
      testContent = generateApiTest(analysis, {});
    } else {
      testContent = generateUtilTest(analysis);
    }

    const testFileName = analysis.fileName.replace(analysis.ext, `.test${analysis.ext}`);
    const testFilePath = join(dirname(resolve(filePath)), testFileName);

    writeFileSync(testFilePath, testContent, "utf-8");
    console.log(green(`\n  ✓ ${testFileName} created at ${dim(dirname(testFilePath))}\n`));

  } else if (mode === "scan") {
    const { scanDir } = await inquirer.prompt([
      {
        type: "input",
        name: "scanDir",
        message: "Directory to scan:",
        default: ".",
      },
    ]);

    const files = findTestableFiles(resolve(scanDir));

    if (files.length === 0) {
      console.log(yellow("\n  No testable files found.\n"));
      return;
    }

    // Check which files already have tests
    const untested = files.filter((f) => {
      const testPath = f.replace(extname(f), `.test${extname(f)}`);
      const specPath = f.replace(extname(f), `.spec${extname(f)}`);
      return !existsSync(testPath) && !existsSync(specPath);
    });

    console.log(bold(`\n  Found ${files.length} source files, ${untested.length} without tests:\n`));
    untested.forEach((f) => console.log(yellow(`    ○ ${f}`)));
    const tested = files.length - untested.length;
    if (tested > 0) {
      console.log(green(`    ✓ ${tested} files already have tests`));
    }

    if (untested.length === 0) {
      console.log(green("\n  All files have tests!\n"));
      return;
    }

    const { selectedFiles } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedFiles",
        message: "Generate tests for:",
        choices: untested.map((f) => ({ name: basename(f), value: f })),
      },
    ]);

    for (const filePath of selectedFiles) {
      const analysis = analyzeSourceFile(filePath);
      let testContent;

      if (analysis.isComponent) {
        testContent = generateComponentTest(analysis, { userEvents: true, props: true });
      } else if (analysis.isHook) {
        testContent = generateHookTest(analysis);
      } else if (analysis.isApi) {
        testContent = generateApiTest(analysis, {});
      } else {
        testContent = generateUtilTest(analysis);
      }

      const testFileName = analysis.fileName.replace(analysis.ext, `.test${analysis.ext}`);
      const testFilePath = join(dirname(filePath), testFileName);

      writeFileSync(testFilePath, testContent, "utf-8");
      console.log(green(`  ✓ ${testFileName}`));
    }

    console.log(green(`\n  Generated ${selectedFiles.length} test file(s)!\n`));

  } else {
    // Manual mode
    const { testName, testType } = await inquirer.prompt([
      {
        type: "input",
        name: "testName",
        message: "Test file name (without .test.ts):",
        validate: (v) => (v.trim() ? true : "Required"),
      },
      {
        type: "list",
        name: "testType",
        message: "Test type:",
        choices: [
          { name: "Unit test", value: "unit" },
          { name: "Integration test", value: "integration" },
          { name: "E2E test (Playwright)", value: "e2e" },
        ],
      },
    ]);

    let content;

    if (testType === "unit") {
      content = `describe("${testName}", () => {
  it("should work correctly", () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
`;
    } else if (testType === "integration") {
      content = `describe("${testName} (integration)", () => {
  beforeAll(async () => {
    // Setup: database connection, server start, etc.
  });

  afterAll(async () => {
    // Cleanup
  });

  it("should handle the full flow", async () => {
    // TODO: Implement integration test
    expect(true).toBe(true);
  });
});
`;
    } else {
      content = `import { test, expect } from "@playwright/test";

test.describe("${testName}", () => {
  test("should load the page", async ({ page }) => {
    await page.goto("/");
    // TODO: Add assertions
    await expect(page).toHaveTitle(/.*/);
  });
});
`;
    }

    const { outputDir } = await inquirer.prompt([
      {
        type: "input",
        name: "outputDir",
        message: "Output directory:",
        default: testType === "e2e" ? "./e2e" : "./__tests__",
      },
    ]);

    const dir = resolve(outputDir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const ext = testType === "e2e" ? ".spec.ts" : ".test.ts";
    const testFilePath = join(dir, `${testName}${ext}`);

    writeFileSync(testFilePath, content, "utf-8");
    console.log(green(`\n  ✓ ${testName}${ext} created at ${dim(dir)}\n`));
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
