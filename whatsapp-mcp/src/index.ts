#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { GreenAPIClient } from "./whatsapp.js";

// ---------------------------------------------------------------------------
// Bootstrap Green API client
// ---------------------------------------------------------------------------

const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const TOKEN = process.env.GREEN_API_TOKEN;

if (!INSTANCE_ID || !TOKEN) {
  console.error(
    "ERROR: GREEN_API_INSTANCE_ID and GREEN_API_TOKEN environment variables must be set."
  );
  process.exit(1);
}

const client = new GreenAPIClient(INSTANCE_ID, TOKEN);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: "send_message",
    description:
      "Send a WhatsApp text message to a phone number or group. " +
      "For individuals use the format '79001234567@c.us'. " +
      "For groups use '79001234567-1234567890@g.us'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chatId: {
          type: "string",
          description:
            "Recipient chat ID (e.g. '79001234567@c.us' or group ID ending in '@g.us')",
        },
        message: {
          type: "string",
          description: "Text message to send",
        },
      },
      required: ["chatId", "message"],
    },
  },
  {
    name: "send_file",
    description:
      "Send a file or image to a WhatsApp chat by providing a publicly accessible URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chatId: {
          type: "string",
          description: "Recipient chat ID",
        },
        urlFile: {
          type: "string",
          description: "Publicly accessible URL of the file to send",
        },
        fileName: {
          type: "string",
          description: "File name including extension (e.g. 'photo.jpg')",
        },
        caption: {
          type: "string",
          description: "Optional caption for the file",
        },
      },
      required: ["chatId", "urlFile", "fileName"],
    },
  },
  {
    name: "get_chats",
    description: "List all recent WhatsApp chats for the connected account.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_chat_history",
    description: "Retrieve message history from a specific WhatsApp chat.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chatId: {
          type: "string",
          description: "Chat ID to retrieve history for",
        },
        count: {
          type: "number",
          description: "Number of messages to retrieve (default: 50, max: 100)",
        },
      },
      required: ["chatId"],
    },
  },
  {
    name: "schedule_message",
    description:
      "Schedule a WhatsApp text message to be sent at a future date and time. " +
      "Messages are stored in a local JSON queue. Use 'process_scheduled_messages' " +
      "or set up a cron job to dispatch them.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chatId: {
          type: "string",
          description: "Recipient chat ID",
        },
        message: {
          type: "string",
          description: "Text message to send",
        },
        scheduledAt: {
          type: "string",
          description:
            "ISO 8601 datetime when the message should be sent (e.g. '2024-12-31T10:00:00Z')",
        },
      },
      required: ["chatId", "message", "scheduledAt"],
    },
  },
  {
    name: "get_incoming_messages",
    description:
      "Retrieve unread / new incoming WhatsApp messages. " +
      "This drains the notification queue from Green API (pull model). " +
      "Each call consumes and acknowledges up to 'limit' notifications.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description:
            "Maximum number of incoming messages to retrieve (default: 20)",
        },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "whatsapp-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ------------------------------------------------------------------
      case "send_message": {
        const { chatId, message } = args as { chatId: string; message: string };
        if (!chatId || !message) {
          return errorResponse("send_message requires 'chatId' and 'message'.");
        }
        const result = await client.sendMessage({ chatId, message });
        return successResponse(
          `Message sent successfully. idMessage: ${result.idMessage}`
        );
      }

      // ------------------------------------------------------------------
      case "send_file": {
        const { chatId, urlFile, fileName, caption } = args as {
          chatId: string;
          urlFile: string;
          fileName: string;
          caption?: string;
        };
        if (!chatId || !urlFile || !fileName) {
          return errorResponse(
            "send_file requires 'chatId', 'urlFile', and 'fileName'."
          );
        }
        const result = await client.sendFileByUrl({
          chatId,
          urlFile,
          fileName,
          caption,
        });
        return successResponse(
          `File sent successfully. idMessage: ${result.idMessage}`
        );
      }

      // ------------------------------------------------------------------
      case "get_chats": {
        const chats = await client.getChats();
        if (!chats || chats.length === 0) {
          return successResponse("No chats found.");
        }
        const formatted = chats
          .map((c, i) => {
            const name = c.name ?? "(no name)";
            const last = c.lastMessage ?? "";
            const ts = c.lastMessageTimestamp
              ? new Date(c.lastMessageTimestamp * 1000).toISOString()
              : "unknown";
            return `${i + 1}. [${c.id}] ${name}\n   Last message: ${last}\n   Timestamp: ${ts}`;
          })
          .join("\n\n");
        return successResponse(`${chats.length} chats found:\n\n${formatted}`);
      }

      // ------------------------------------------------------------------
      case "get_chat_history": {
        const { chatId, count } = args as { chatId: string; count?: number };
        if (!chatId) {
          return errorResponse("get_chat_history requires 'chatId'.");
        }
        const messages = await client.getChatHistory({
          chatId,
          count: Math.min(count ?? 50, 100),
        });
        if (!messages || messages.length === 0) {
          return successResponse(`No messages found in chat ${chatId}.`);
        }
        const formatted = messages
          .map((m, i) => {
            const ts = new Date(m.timestamp * 1000).toISOString();
            const sender = m.senderName ?? m.senderId ?? "unknown";
            const text = m.textMessage ?? m.caption ?? `[${m.typeMessage}]`;
            return `${i + 1}. [${ts}] ${sender}: ${text}`;
          })
          .join("\n");
        return successResponse(
          `${messages.length} messages in chat ${chatId}:\n\n${formatted}`
        );
      }

      // ------------------------------------------------------------------
      case "schedule_message": {
        const { chatId, message, scheduledAt } = args as {
          chatId: string;
          message: string;
          scheduledAt: string;
        };
        if (!chatId || !message || !scheduledAt) {
          return errorResponse(
            "schedule_message requires 'chatId', 'message', and 'scheduledAt'."
          );
        }
        // Validate ISO 8601
        const date = new Date(scheduledAt);
        if (isNaN(date.getTime())) {
          return errorResponse(
            `Invalid scheduledAt value: "${scheduledAt}". Use ISO 8601 format.`
          );
        }
        const entry = client.scheduleMessage(chatId, message, scheduledAt);
        return successResponse(
          `Message scheduled successfully.\n` +
            `ID: ${entry.id}\n` +
            `Chat: ${entry.chatId}\n` +
            `Scheduled at: ${entry.scheduledAt}\n` +
            `Status: pending`
        );
      }

      // ------------------------------------------------------------------
      case "get_incoming_messages": {
        const { limit } = args as { limit?: number };
        const notifications = await client.drainIncomingMessages(limit ?? 20);
        if (notifications.length === 0) {
          return successResponse("No new incoming messages.");
        }
        const formatted = notifications
          .map((n, i) => {
            const body = n.body;
            const sender = body.senderData
              ? `${body.senderData.senderName} (${body.senderData.senderId})`
              : "unknown";
            const chatId = body.senderData?.chatId ?? "unknown";
            const ts = new Date(body.timestamp * 1000).toISOString();
            const msgType = body.messageData?.typeMessage ?? "unknown";
            const text =
              body.messageData?.textMessageData?.textMessage ??
              body.messageData?.fileMessageData?.caption ??
              `[${msgType}]`;
            return (
              `${i + 1}. [${ts}]\n` +
              `   From: ${sender}\n` +
              `   Chat: ${chatId}\n` +
              `   Message: ${text}`
            );
          })
          .join("\n\n");
        return successResponse(
          `${notifications.length} incoming message(s):\n\n${formatted}`
        );
      }

      // ------------------------------------------------------------------
      default:
        return errorResponse(`Unknown tool: "${name}"`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`Tool execution failed: ${message}`);
  }
});

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function successResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorResponse(text: string) {
  return {
    content: [{ type: "text" as const, text: `ERROR: ${text}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Start server on stdio
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't interfere with stdio MCP protocol
  console.error("WhatsApp MCP server started (stdio transport).");
}

main().catch((err) => {
  console.error("Fatal error starting WhatsApp MCP server:", err);
  process.exit(1);
});
