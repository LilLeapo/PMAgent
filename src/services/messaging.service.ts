import { client } from './feishu-client.js';
import { logger } from '../utils/logger.js';

export async function replyText(messageId: string, text: string): Promise<void> {
  try {
    const res = await client.im.message.reply({
      path: { message_id: messageId },
      data: {
        content: JSON.stringify({ text }),
        msg_type: 'text',
      },
    });
    logger.info('replyText success', { messageId, code: res.code, msg: res.msg });
  } catch (err: any) {
    logger.error('replyText failed', { messageId, error: err?.message || err, code: err?.code, response: err?.response?.data });
    throw err;
  }
}

export async function sendText(chatId: string, text: string): Promise<string | undefined> {
  const res = await client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      content: JSON.stringify({ text }),
      msg_type: 'text',
    },
  });
  return res.data?.message_id;
}

export async function sendCard(chatId: string, card: object): Promise<string | undefined> {
  const res = await client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      content: JSON.stringify(card),
      msg_type: 'interactive',
    },
  });
  return res.data?.message_id;
}

export async function replyCard(messageId: string, card: object): Promise<void> {
  await client.im.message.reply({
    path: { message_id: messageId },
    data: {
      content: JSON.stringify(card),
      msg_type: 'interactive',
    },
  });
}

export async function sendDM(openId: string, text: string): Promise<void> {
  try {
    await client.im.message.create({
      params: { receive_id_type: 'open_id' },
      data: {
        receive_id: openId,
        content: JSON.stringify({ text }),
        msg_type: 'text',
      },
    });
  } catch (err) {
    logger.warn('Failed to send DM', { openId, error: err });
  }
}

export async function updateCard(messageId: string, card: object): Promise<void> {
  await client.im.message.patch({
    path: { message_id: messageId },
    data: {
      content: JSON.stringify(card),
    },
  });
}
