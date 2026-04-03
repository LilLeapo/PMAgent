import * as lark from '@larksuiteoapi/node-sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { InboundMessage } from '../agent/types.js';

const FEISHU_DOC_PATTERN = /https?:\/\/[a-z0-9-]+\.(?:feishu\.cn|larksuite\.com)\/(?:docx|wiki|docs)\/([a-zA-Z0-9]+)/g;

// Dedup
const processedIds = new Set<string>();

export type MessageHandler = (msg: InboundMessage) => Promise<void>;

export class FeishuChannel {
  private client: lark.Client;
  private wsClient: lark.WSClient;
  private handler?: MessageHandler;

  constructor() {
    this.client = new lark.Client({
      appId: config.FEISHU_APP_ID,
      appSecret: config.FEISHU_APP_SECRET,
      ...(config.FEISHU_BASE_URL ? { domain: config.FEISHU_BASE_URL } : {}),
      loggerLevel: lark.LoggerLevel.info,
    });

    this.wsClient = new lark.WSClient({
      appId: config.FEISHU_APP_ID,
      appSecret: config.FEISHU_APP_SECRET,
      loggerLevel: lark.LoggerLevel.info,
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    const dispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        const event = data.event || data;
        const message = event.message;
        const sender = event.sender;

        if (!message || !sender) return;

        // Dedup
        const msgId = message.message_id;
        if (processedIds.has(msgId)) return;
        processedIds.add(msgId);
        if (processedIds.size > 1000) {
          const first = processedIds.values().next().value!;
          processedIds.delete(first);
        }

        // Only handle text messages
        if (message.message_type !== 'text') return;

        let content: { text: string };
        try {
          content = JSON.parse(message.content);
        } catch {
          return;
        }

        let text = content.text || '';
        const mentions = message.mentions || [];
        const mentionedUserIds: string[] = [];

        // Strip @mention tags
        for (const mention of mentions) {
          text = text.replace(mention.key, '').trim();
          mentionedUserIds.push(mention.id?.open_id || '');
        }

        // In group chats, only respond when @mentioned
        if (message.chat_type === 'group' && mentions.length === 0) return;

        // Extract doc URLs
        const docUrls: string[] = [];
        let match;
        const urlPattern = new RegExp(FEISHU_DOC_PATTERN.source, 'g');
        while ((match = urlPattern.exec(text)) !== null) {
          docUrls.push(match[0]);
        }

        const inbound: InboundMessage = {
          id: msgId,
          chatId: message.chat_id,
          senderId: sender.sender_id?.open_id || '',
          text: text.trim(),
          chatType: message.chat_type === 'group' ? 'group' : 'p2p',
          mentionedUserIds: mentionedUserIds.filter(Boolean),
          docUrls,
          timestamp: Date.now(),
        };

        logger.info('Message received', {
          text: inbound.text.slice(0, 100),
          chatId: inbound.chatId,
          chatType: inbound.chatType,
        });

        if (this.handler) {
          this.handler(inbound).catch(err => {
            logger.error('Handler error', { error: err });
          });
        }
      },
    });

    await this.wsClient.start({ eventDispatcher: dispatcher } as any);
    logger.info('Feishu channel connected');
  }

  /** Reply to a message */
  async reply(messageId: string, text: string): Promise<void> {
    try {
      await this.client.im.message.reply({
        path: { message_id: messageId },
        data: {
          content: JSON.stringify({ text }),
          msg_type: 'text',
        },
      });
    } catch (err: any) {
      logger.error('Reply failed', { messageId, error: err.message });
      throw err;
    }
  }

  /** Send message to a chat */
  async send(chatId: string, text: string): Promise<void> {
    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text }),
        msg_type: 'text',
      },
    });
  }

  /** Send DM to a user */
  async dm(openId: string, text: string): Promise<void> {
    try {
      await this.client.im.message.create({
        params: { receive_id_type: 'open_id' },
        data: {
          receive_id: openId,
          content: JSON.stringify({ text }),
          msg_type: 'text',
        },
      });
    } catch (err: any) {
      logger.warn('DM failed', { openId, error: err.message });
    }
  }
}
