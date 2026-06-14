import axios, { AxiosInstance, AxiosError } from "axios";
import * as fs from "fs";
import * as path from "path";

export interface SendMessageParams {
  chatId: string;
  message: string;
}

export interface SendFileParams {
  chatId: string;
  urlFile: string;
  fileName: string;
  caption?: string;
}

export interface GetChatHistoryParams {
  chatId: string;
  count?: number;
}

export interface ScheduledMessage {
  id: string;
  chatId: string;
  message: string;
  scheduledAt: string; // ISO 8601
  createdAt: string;
  sent: boolean;
}

export interface GreenAPIMessage {
  type: string;
  idMessage: string;
  timestamp: number;
  typeMessage: string;
  chatId: string;
  senderId?: string;
  senderName?: string;
  textMessage?: string;
  downloadUrl?: string;
  caption?: string;
  fileName?: string;
}

export interface GreenAPIChat {
  id: string;
  name?: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
}

export interface GreenAPINotification {
  receiptId: number;
  body: {
    typeWebhook: string;
    instanceData: {
      idInstance: number;
      wid: string;
      typeInstance: string;
    };
    timestamp: number;
    idMessage: string;
    senderData?: {
      chatId: string;
      chatName: string;
      senderId: string;
      senderName: string;
    };
    messageData?: {
      typeMessage: string;
      textMessageData?: { textMessage: string };
      fileMessageData?: {
        downloadUrl: string;
        caption: string;
        fileName: string;
        jpegThumbnail?: string;
      };
    };
  };
}

const QUEUE_FILE = path.join(process.cwd(), "scheduled_messages.json");

function loadQueue(): ScheduledMessage[] {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    const raw = fs.readFileSync(QUEUE_FILE, "utf-8");
    return JSON.parse(raw) as ScheduledMessage[];
  } catch {
    return [];
  }
}

function saveQueue(queue: ScheduledMessage[]): void {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf-8");
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class GreenAPIClient {
  private http: AxiosInstance;
  private instanceId: string;
  private token: string;

  constructor(instanceId: string, token: string) {
    this.instanceId = instanceId;
    this.token = token;
    this.http = axios.create({
      baseURL: `https://api.green-api.com/waInstance${instanceId}/`,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });
  }

  private handleError(error: unknown, context: string): never {
    if (error instanceof AxiosError) {
      const status = error.response?.status ?? "unknown";
      const data = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      throw new Error(`[${context}] HTTP ${status}: ${data}`);
    }
    throw new Error(`[${context}] ${String(error)}`);
  }

  /**
   * Send a text message to a chat or group.
   * chatId format: "79001234567@c.us" for individuals, "79001234567-1234567890@g.us" for groups.
   */
  async sendMessage(params: SendMessageParams): Promise<{ idMessage: string }> {
    try {
      const res = await this.http.post(`sendMessage/${this.token}`, {
        chatId: params.chatId,
        message: params.message,
      });
      return res.data as { idMessage: string };
    } catch (err) {
      this.handleError(err, "sendMessage");
    }
  }

  /**
   * Send a file/image by URL.
   */
  async sendFileByUrl(params: SendFileParams): Promise<{ idMessage: string }> {
    try {
      const res = await this.http.post(`sendFileByUrl/${this.token}`, {
        chatId: params.chatId,
        urlFile: params.urlFile,
        fileName: params.fileName,
        caption: params.caption ?? "",
      });
      return res.data as { idMessage: string };
    } catch (err) {
      this.handleError(err, "sendFileByUrl");
    }
  }

  /**
   * Get list of recent chats.
   */
  async getChats(): Promise<GreenAPIChat[]> {
    try {
      const res = await this.http.get(`getChats/${this.token}`);
      return res.data as GreenAPIChat[];
    } catch (err) {
      this.handleError(err, "getChats");
    }
  }

  /**
   * Get message history for a specific chat.
   */
  async getChatHistory(params: GetChatHistoryParams): Promise<GreenAPIMessage[]> {
    try {
      const res = await this.http.post(`getChatHistory/${this.token}`, {
        chatId: params.chatId,
        count: params.count ?? 50,
      });
      return res.data as GreenAPIMessage[];
    } catch (err) {
      this.handleError(err, "getChatHistory");
    }
  }

  /**
   * Receive one incoming notification (webhook pull model).
   * Returns null if no pending notifications.
   */
  async receiveNotification(): Promise<GreenAPINotification | null> {
    try {
      const res = await this.http.get(`receiveNotification/${this.token}`);
      if (!res.data) return null;
      return res.data as GreenAPINotification;
    } catch (err) {
      this.handleError(err, "receiveNotification");
    }
  }

  /**
   * Delete (acknowledge) a notification by receiptId.
   */
  async deleteNotification(receiptId: number): Promise<boolean> {
    try {
      const res = await this.http.delete(
        `deleteNotification/${this.token}/${receiptId}`
      );
      const data = res.data as { result: boolean };
      return data.result;
    } catch (err) {
      this.handleError(err, "deleteNotification");
    }
  }

  /**
   * Drain all pending incoming message notifications and return them.
   * Automatically deletes each notification after reading.
   */
  async drainIncomingMessages(limit = 20): Promise<GreenAPINotification[]> {
    const messages: GreenAPINotification[] = [];
    for (let i = 0; i < limit; i++) {
      const notification = await this.receiveNotification();
      if (!notification) break;

      // Only collect inbound message webhooks
      if (notification.body.typeWebhook === "incomingMessageReceived") {
        messages.push(notification);
      }

      // Always delete to advance the queue
      await this.deleteNotification(notification.receiptId);
    }
    return messages;
  }

  // -------------------------------------------------------------------------
  // Scheduled message queue (persisted to JSON file)
  // -------------------------------------------------------------------------

  /**
   * Schedule a message to be sent at a future time.
   * Messages are stored in `scheduled_messages.json` in the working directory.
   */
  scheduleMessage(chatId: string, message: string, scheduledAt: string): ScheduledMessage {
    const queue = loadQueue();
    const entry: ScheduledMessage = {
      id: generateId(),
      chatId,
      message,
      scheduledAt,
      createdAt: new Date().toISOString(),
      sent: false,
    };
    queue.push(entry);
    saveQueue(queue);
    return entry;
  }

  /**
   * Process due scheduled messages — send them and mark as sent.
   * Returns the list of messages that were dispatched.
   */
  async processDueMessages(): Promise<ScheduledMessage[]> {
    const queue = loadQueue();
    const now = Date.now();
    const dispatched: ScheduledMessage[] = [];

    for (const item of queue) {
      if (!item.sent && new Date(item.scheduledAt).getTime() <= now) {
        try {
          await this.sendMessage({ chatId: item.chatId, message: item.message });
          item.sent = true;
          dispatched.push(item);
        } catch (err) {
          // Leave unsent for retry on next call
        }
      }
    }

    if (dispatched.length > 0) saveQueue(queue);
    return dispatched;
  }

  /**
   * Return all scheduled messages (sent and pending).
   */
  listScheduledMessages(): ScheduledMessage[] {
    return loadQueue();
  }
}
