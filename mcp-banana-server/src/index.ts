import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://api.banana-service.local/v1";

interface ApiError {
  status: number;
  body: unknown;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  let body: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  try {
    body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    body = "(empty body)";
  }

  if (!response.ok) {
    throw { status: response.status, body } as ApiError;
  }

  return body as T;
}

function formatApiError(err: unknown): string {
  if (typeof err === "object" && err !== null && "status" in err && "body" in err) {
    const { status, body } = err as ApiError;
    return `API error ${status}: ${JSON.stringify(body)}`;
  }
  if (err instanceof Error) return `Unexpected error: ${err.message}`;
  return `Unknown error: ${String(err)}`;
}

interface BananaStatus {
  status: string;
  ripeness: string;
  inventory: number;
}

interface PeelResult {
  success: boolean;
  remaining_inventory: number;
  message: string;
}

const server = new McpServer({
  name: "banana-service",
  version: "1.0.0",
});

server.tool(
  "get_banana_status",
  "Retrieve the current status, ripeness level, and total inventory count of bananas. Use this to check if bananas are ready before peeling.",
  {},
  async () => {
    try {
      const data = await apiFetch<BananaStatus>("/banana/status", { method: "GET" });
      return {
        content: [
          {
            type: "text",
            text:
              `Banana Status Report\n\n` +
              `  Status:    ${data.status}\n` +
              `  Ripeness:  ${data.ripeness}\n` +
              `  Inventory: ${data.inventory} banana(s) available`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to fetch banana status. ${formatApiError(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "peel_bananas",
  "Peel one or more bananas from the inventory. Decrements inventory by the specified amount. Returns success confirmation, a message, and remaining inventory.",
  {
    amount: z
      .number()
      .int()
      .positive()
      .describe("The number of bananas to peel. Must be a positive integer. Example: 1"),
  },
  async ({ amount }) => {
    try {
      const data = await apiFetch<PeelResult>("/banana/peel", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });

      if (!data.success) {
        return {
          content: [{ type: "text", text: `Peel action failed. Message: ${data.message ?? "No message provided."}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text:
              `Peel Successful!\n\n` +
              `  Message:             ${data.message}\n` +
              `  Remaining Inventory: ${data.remaining_inventory} banana(s)`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to peel banana(s). ${formatApiError(err)}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[banana-service MCP] Server running on stdio.");
}

main().catch((err) => {
  console.error("[FATAL] Server crashed:", err);
  process.exit(1);
});
