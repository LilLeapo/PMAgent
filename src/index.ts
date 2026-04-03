import * as lark from '@larksuiteoapi/node-sdk';
import { config } from './config.js';
import { createEventDispatcher } from './gateway/event-handler.js';
import { handleCardAction } from './gateway/card-action-handler.js';
import { startScheduler } from './scheduler/scheduler.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('Starting PM Agent...', { botName: config.BOT_NAME });

  // Get bot's own open_id for @mention detection
  let botOpenId: string | undefined;
  try {
    const client = new lark.Client({
      appId: config.FEISHU_APP_ID,
      appSecret: config.FEISHU_APP_SECRET,
    });
    const botInfo = await (client as any).bot.botInfo.get();
    botOpenId = botInfo.data?.bot?.open_id;
    logger.info('Bot info retrieved', { openId: botOpenId });
  } catch (err) {
    logger.warn('Failed to get bot info, @mention filtering may not work', { error: err });
  }

  // Create event dispatcher
  const eventDispatcher = createEventDispatcher(botOpenId);

  // Start WebSocket client (no public URL needed)
  const wsClient = new lark.WSClient({
    appId: config.FEISHU_APP_ID,
    appSecret: config.FEISHU_APP_SECRET,
    loggerLevel: lark.LoggerLevel.info,
  });

  await wsClient.start({
    eventDispatcher,
  } as any);

  logger.info('WebSocket client connected');

  // Start scheduled jobs
  startScheduler();

  logger.info('PM Agent is running! Waiting for messages...');

  // Keep process alive
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Fatal error', { error: err });
  process.exit(1);
});
