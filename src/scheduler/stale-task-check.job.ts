import * as bitable from '../services/bitable.service.js';
import * as messaging from '../services/messaging.service.js';
import * as cycleManager from '../agents/cycle-manager.js';
import { tableIds } from '../repositories/table-ids.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export async function runStaleTaskCheck(): Promise<void> {
  const activeCycle = await cycleManager.getActiveCycle();
  if (!activeCycle) return;

  const tasks = await bitable.searchRecords(tableIds.tasks, {
    conjunction: 'and',
    conditions: [{ field_name: '迭代', operator: 'contains', value: [activeCycle.record_id] }],
  });

  const now = Date.now();
  const staleDays = config.STALE_TASK_DAYS;
  const blockedHours = config.BLOCKED_TASK_HOURS;
  const staleThreshold = now - staleDays * 24 * 60 * 60 * 1000;
  const blockedThreshold = now - blockedHours * 60 * 60 * 1000;

  // Tasks "In Progress" with no update for STALE_TASK_DAYS
  const staleTasks = tasks.filter(t => {
    const updated = t.fields['更新时间'] as number;
    return t.fields['状态'] === 'In Progress' && updated && updated < staleThreshold;
  });

  // Tasks "Blocked" for more than BLOCKED_TASK_HOURS
  const longBlockedTasks = tasks.filter(t => {
    const updated = t.fields['更新时间'] as number;
    return t.fields['状态'] === 'Blocked' && updated && updated < blockedThreshold;
  });

  // Notify stale task owners
  for (const t of staleTasks) {
    const assignee = t.fields['负责人'] as Array<{ id: string }>;
    if (assignee?.[0]) {
      await messaging.sendDM(
        assignee[0].id,
        `💤 任务提醒：「${t.fields['标题']}」已 ${staleDays} 天没有更新，请更新进展。`,
      );
    }
  }

  // Notify blocked task owners + cycle owner
  const cycleOwner = activeCycle.fields['负责人'] as Array<{ id: string }>;

  for (const t of longBlockedTasks) {
    const assignee = t.fields['负责人'] as Array<{ id: string }>;
    if (assignee?.[0]) {
      await messaging.sendDM(
        assignee[0].id,
        `🚫 任务「${t.fields['标题']}」已阻塞超过 ${blockedHours} 小时，请寻求帮助或更新状态。`,
      );
    }
    // Also notify cycle owner
    if (cycleOwner?.[0]) {
      await messaging.sendDM(
        cycleOwner[0].id,
        `🚫 团队成员的任务「${t.fields['标题']}」已阻塞超过 ${blockedHours} 小时，可能需要你介入。`,
      );
    }
  }

  // Due date reminders: tasks due tomorrow
  const tomorrow = now + 24 * 60 * 60 * 1000;
  const dueSoonTasks = tasks.filter(t => {
    const due = t.fields['截止日期'] as number;
    return due && due > now && due <= tomorrow && t.fields['状态'] !== 'Done';
  });

  for (const t of dueSoonTasks) {
    const assignee = t.fields['负责人'] as Array<{ id: string }>;
    if (assignee?.[0]) {
      await messaging.sendDM(
        assignee[0].id,
        `⏰ 任务「${t.fields['标题']}」将在明天到期，请确保按时完成。`,
      );
    }
  }

  logger.info('Stale task check completed', {
    stale: staleTasks.length,
    longBlocked: longBlockedTasks.length,
    dueSoon: dueSoonTasks.length,
  });
}
