import type { CardAction } from '../models/feishu-events.model.js';
import * as messaging from '../services/messaging.service.js';
import { logger } from '../utils/logger.js';

export async function handleCardAction(data: CardAction): Promise<object | void> {
  const { action, open_chat_id, open_id } = data;
  const value = action.value;

  logger.info('Card action received', { action: value, user: open_id });

  try {
    switch (value.action) {
      case 'confirm_tasks': {
        await messaging.sendText(open_chat_id, '任务已确认创建到多维表格。');
        return { toast: { type: 'success', content: '任务已创建' } };
      }

      case 'edit_tasks': {
        await messaging.sendText(
          open_chat_id,
          '请描述你想调整的部分，例如："把第3个任务拆成两个" 或 "优先级都调高一档"',
        );
        return { toast: { type: 'info', content: '请在群里描述需要的调整' } };
      }

      default:
        logger.warn('Unknown card action', { value });
    }
  } catch (err) {
    logger.error('Card action handler error', { error: err, value });
    return { toast: { type: 'error', content: '操作失败，请重试' } };
  }
}
