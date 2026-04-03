import * as cycleManager from '../agents/cycle-manager.js';
import * as bitable from '../services/bitable.service.js';
import * as messaging from '../services/messaging.service.js';
import { tableIds } from '../repositories/table-ids.js';
import { logger } from '../utils/logger.js';

export async function runStandupReminder(): Promise<void> {
  const activeCycle = await cycleManager.getActiveCycle();
  if (!activeCycle) return;

  const chatId = activeCycle.fields['通知群'] as string;
  if (!chatId) {
    logger.warn('Active cycle has no notification chat configured');
    return;
  }

  // Get cycle stats
  const tasks = await bitable.searchRecords(tableIds.tasks, {
    conjunction: 'and',
    conditions: [{ field_name: '迭代', operator: 'contains', value: [activeCycle.record_id] }],
  });

  const inProgress = tasks.filter(t => t.fields['状态'] === 'In Progress');
  const blocked = tasks.filter(t => t.fields['状态'] === 'Blocked');
  const done = tasks.filter(t => t.fields['状态'] === 'Done');
  const daysLeft = Math.ceil(
    ((activeCycle.fields['结束日期'] as number) - Date.now()) / (24 * 60 * 60 * 1000),
  );

  // Build standup message
  const lines: string[] = [
    `📊 **${activeCycle.fields['名称']} 站会提醒**`,
    `进度: ${done.length}/${tasks.length} 完成 | 剩余 ${daysLeft} 天`,
    '',
  ];

  if (blocked.length > 0) {
    lines.push('🚫 **阻塞任务**:');
    for (const t of blocked) {
      const assignee = t.fields['负责人'] as Array<{ id: string; name?: string }>;
      const name = assignee?.[0]?.name || '未分配';
      lines.push(`  • ${t.fields['标题']} (${name})`);
    }
    lines.push('');
  }

  // Check overdue tasks
  const overdue = tasks.filter(t => {
    const due = t.fields['截止日期'] as number;
    return due && due < Date.now() && t.fields['状态'] !== 'Done';
  });

  if (overdue.length > 0) {
    lines.push('⏰ **逾期任务**:');
    for (const t of overdue) {
      lines.push(`  • ${t.fields['标题']}`);
    }
    lines.push('');
  }

  lines.push('请各位更新任务状态 🙏');

  await messaging.sendText(chatId, lines.join('\n'));

  // DM blocked task owners
  for (const t of blocked) {
    const assignee = t.fields['负责人'] as Array<{ id: string }>;
    if (assignee?.[0]) {
      await messaging.sendDM(
        assignee[0].id,
        `提醒：你负责的任务「${t.fields['标题']}」处于阻塞状态，请更新进展或寻求帮助。`,
      );
    }
  }

  // DM overdue task owners
  for (const t of overdue) {
    const assignee = t.fields['负责人'] as Array<{ id: string }>;
    if (assignee?.[0]) {
      await messaging.sendDM(
        assignee[0].id,
        `提醒：你负责的任务「${t.fields['标题']}」已逾期，请尽快处理。`,
      );
    }
  }
}
