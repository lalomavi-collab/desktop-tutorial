# WhatsApp MCP Server

A Model Context Protocol (MCP) server that connects Claude Desktop (or any MCP client) to WhatsApp via the [Green API](https://green-api.com) gateway.

## Features

| Tool | Description |
|---|---|
| `send_message` | Send a text message to a phone number or group |
| `send_file` | Send a file/image by public URL |
| `get_chats` | List all recent chats |
| `get_chat_history` | Retrieve message history from a chat |
| `schedule_message` | Schedule a message for later (stored in a local JSON queue) |
| `get_incoming_messages` | Drain and return unread/new incoming messages |

## Prerequisites

1. A [Green API](https://green-api.com) account and a connected WhatsApp instance.
2. Your **Instance ID** and **API Token** from the Green API dashboard.
3. Node.js 18+.

## Setup

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables before running:

```bash
export GREEN_API_INSTANCE_ID="your_instance_id"
export GREEN_API_TOKEN="your_api_token"
```

## Running

```bash
# Production (compiled)
npm start

# Development (ts-node)
npm run dev
```

## Claude Desktop Integration

Add the following to your Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/whatsapp-mcp/dist/index.js"],
      "env": {
        "GREEN_API_INSTANCE_ID": "your_instance_id",
        "GREEN_API_TOKEN": "your_api_token"
      }
    }
  }
}
```

Restart Claude Desktop. The WhatsApp tools will appear automatically.

## Chat ID Formats

- **Individual**: `79001234567@c.us` (country code + number, no `+`)
- **Group**: `79001234567-1234567890@g.us`

## Scheduled Messages

Scheduled messages are stored in `scheduled_messages.json` in the working directory. To actually dispatch them you can either:

1. Call `get_incoming_messages` which also triggers `processDueMessages` internally (the server polls on each tool invocation), **or**
2. Add a cron job that periodically runs the server's internal polling. For example, wrap it in a small script that calls `client.processDueMessages()` every minute.

## Green API Endpoints Used

| Action | Method | Endpoint |
|---|---|---|
| Send text | POST | `sendMessage/{token}` |
| Send file | POST | `sendFileByUrl/{token}` |
| Get chats | GET | `getChats/{token}` |
| Get history | POST | `getChatHistory/{token}` |
| Receive notification | GET | `receiveNotification/{token}` |
| Delete notification | DELETE | `deleteNotification/{token}/{receiptId}` |
