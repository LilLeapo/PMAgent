import type { MessageEvent, TextContent } from '../models/feishu-events.model.js';
import { logger } from '../utils/logger.js';

export interface ParsedMessage {
  text: string;
  chatId: string;
  messageId: string;
  senderId: string;
  chatType: string;
  isMentioned: boolean;
  mentionedUserIds: string[];
  feishuDocUrls: string[];
}

const FEISHU_DOC_PATTERN = /https?:\/\/[a-z0-9-]+\.(?:feishu\.cn|larksuite\.com)\/(?:docx|wiki|docs)\/([a-zA-Z0-9]+)/g;

export function parseMessage(event: MessageEvent, botOpenId?: string): ParsedMessage | null {
  const { message, sender } = event;

  if (message.message_type !== 'text') {
    logger.debug('Skipping non-text message', { type: message.message_type });
    return null;
  }

  let content: TextContent;
  try {
    content = JSON.parse(message.content);
  } catch {
    logger.warn('Failed to parse message content', { content: message.content });
    return null;
  }

  let text = content.text || '';

  // Remove @mention tags from text
  const mentions = message.mentions || [];
  const mentionedUserIds: string[] = [];
  let isMentioned = false;

  for (const mention of mentions) {
    text = text.replace(mention.key, '').trim();
    if (botOpenId && mention.id.open_id === botOpenId) {
      isMentioned = true;
    } else {
      mentionedUserIds.push(mention.id.open_id);
    }
  }

  // In group chats, only respond when @mentioned
  if (message.chat_type === 'group' && !isMentioned) {
    return null;
  }

  // Extract Feishu document URLs
  const feishuDocUrls: string[] = [];
  let match;
  while ((match = FEISHU_DOC_PATTERN.exec(text)) !== null) {
    feishuDocUrls.push(match[0]);
  }

  return {
    text: text.trim(),
    chatId: message.chat_id,
    messageId: message.message_id,
    senderId: sender.sender_id.open_id,
    chatType: message.chat_type,
    isMentioned,
    mentionedUserIds,
    feishuDocUrls,
  };
}
