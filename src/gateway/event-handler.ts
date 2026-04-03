import * as lark from '@larksuiteoapi/node-sdk';
import type { MessageEvent } from '../models/feishu-events.model.js';
import { parseMessage } from './message-parser.js';
import { handleMessage } from '../router/command-router.js';
import { logger } from '../utils/logger.js';

// Dedup: track processed message IDs (last 1000)
const processedMessages = new Set<string>();
const MAX_DEDUP_SIZE = 1000;

function dedup(messageId: string): boolean {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  if (processedMessages.size > MAX_DEDUP_SIZE) {
    const first = processedMessages.values().next().value!;
    processedMessages.delete(first);
  }
  return false;
}

export function createEventDispatcher(botOpenId?: string): lark.EventDispatcher {
  return new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data: any) => {
      logger.info('Raw event received', {
        hasEvent: !!data.event,
        keys: Object.keys(data),
        messageType: data.event?.message?.message_type || data.message?.message_type,
        chatType: data.event?.message?.chat_type || data.message?.chat_type,
        content: data.event?.message?.content || data.message?.content,
        mentions: data.event?.message?.mentions || data.message?.mentions,
      });

      const event = (data.event || data) as MessageEvent;
      const msgId = event.message.message_id;

      if (dedup(msgId)) {
        logger.debug('Duplicate message, skipping', { msgId });
        return;
      }

      const parsed = parseMessage(event, botOpenId);
      if (!parsed) {
        logger.info('Message filtered out by parser', { msgId, chatType: event.message.chat_type });
        return;
      }

      logger.info('Processing message', {
        text: parsed.text.slice(0, 100),
        chatId: parsed.chatId,
        sender: parsed.senderId,
      });

      // Handle asynchronously so we don't block the event loop
      handleMessage(parsed).catch(err => {
        logger.error('Unhandled error in message handler', { error: err });
      });
    },
  });
}
