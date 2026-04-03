import { chatCompletion } from './base-agent.js';
import { CYCLE_STATUS_SYSTEM_PROMPT, CYCLE_RETRO_SYSTEM_PROMPT } from './prompts/cycle-management.js';
import * as bitable from '../services/bitable.service.js';
import { tableIds } from '../repositories/table-ids.js';
import type { Cycle } from '../models/cycle.model.js';
import { logger } from '../utils/logger.js';

export async function createCycle(cycle: Omit<Cycle, 'record_id'>): Promise<string> {
  const record = await bitable.createRecord(tableIds.cycles, {
    '名称': cycle.name,
    '状态': cycle.status,
    '开始日期': new Date(cycle.start_date).getTime(),
    '结束日期': new Date(cycle.end_date).getTime(),
    '目标': cycle.goal,
    ...(cycle.owner ? { '负责人': [{ id: cycle.owner }] } : {}),
  });
  logger.info('Created cycle', { name: cycle.name, recordId: record.record_id });
  return record.record_id;
}

export async function getActiveCycle(): Promise<bitable.BitableRecord | null> {
  const records = await bitable.searchRecords(tableIds.cycles, {
    conjunction: 'and',
    conditions: [{ field_name: '状态', operator: 'is', value: ['Active'] }],
  });
  return records[0] || null;
}

export async function getCycleStatus(cycleRecordId: string): Promise<string> {
  const cycle = await bitable.getRecord(tableIds.cycles, cycleRecordId);
  const tasks = await bitable.searchRecords(tableIds.tasks, {
    conjunction: 'and',
    conditions: [{ field_name: '迭代', operator: 'contains', value: [cycleRecordId] }],
  });

  const statusCounts: Record<string, number> = {};
  let totalEffort = 0;
  let doneEffort = 0;

  for (const task of tasks) {
    const status = task.fields['状态'] as string;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const effort = (task.fields['预估工时'] as number) || 0;
    totalEffort += effort;
    if (status === 'Done') doneEffort += effort;
  }

  const data = JSON.stringify({
    cycle_name: cycle.fields['名称'],
    cycle_goal: cycle.fields['目标'],
    start_date: cycle.fields['开始日期'],
    end_date: cycle.fields['结束日期'],
    total_tasks: tasks.length,
    status_breakdown: statusCounts,
    total_effort: totalEffort,
    done_effort: doneEffort,
    blocked_tasks: tasks
      .filter(t => t.fields['状态'] === 'Blocked')
      .map(t => ({ title: t.fields['标题'], assignee: t.fields['负责人'] })),
    overdue_tasks: tasks
      .filter(t => {
        const due = t.fields['截止日期'] as number;
        return due && due < Date.now() && t.fields['状态'] !== 'Done';
      })
      .map(t => ({ title: t.fields['标题'], due: t.fields['截止日期'] })),
  });

  const res = await chatCompletion([
    { role: 'system', content: CYCLE_STATUS_SYSTEM_PROMPT },
    { role: 'user', content: data },
  ]);
  return res.content || '';
}

export async function closeCycle(cycleRecordId: string): Promise<{ summary: string; movedTasks: number }> {
  // Get incomplete tasks
  const tasks = await bitable.searchRecords(tableIds.tasks, {
    conjunction: 'and',
    conditions: [{ field_name: '迭代', operator: 'contains', value: [cycleRecordId] }],
  });

  const incompleteTasks = tasks.filter(t => t.fields['状态'] !== 'Done');

  // Move incomplete tasks back to Backlog
  for (const task of incompleteTasks) {
    await bitable.updateRecord(tableIds.tasks, task.record_id, {
      '状态': 'Backlog',
      '迭代': null,
    });
  }

  // Mark cycle completed
  await bitable.updateRecord(tableIds.cycles, cycleRecordId, { '状态': 'Completed' });

  // Generate retro summary
  const data = JSON.stringify({
    total_tasks: tasks.length,
    completed: tasks.length - incompleteTasks.length,
    incomplete: incompleteTasks.length,
    incomplete_titles: incompleteTasks.map(t => t.fields['标题']),
  });

  const retro = await chatCompletion([
    { role: 'system', content: CYCLE_RETRO_SYSTEM_PROMPT },
    { role: 'user', content: data },
  ]);
  const summary = retro.content || '';

  // Save retro
  await bitable.updateRecord(tableIds.cycles, cycleRecordId, { '回顾': summary });

  return { summary, movedTasks: incompleteTasks.length };
}
