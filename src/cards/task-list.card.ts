import type { DecompositionResult } from '../models/task.model.js';

const PRIORITY_EMOJI: Record<string, string> = {
  'P0-Critical': '🔴',
  'P1-High': '🟠',
  'P2-Medium': '🟡',
  'P3-Low': '🟢',
};

export function buildTaskListCard(result: DecompositionResult, requirementId: string) {
  const taskElements = result.tasks.map((task, i) => ({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `${PRIORITY_EMOJI[task.priority] || '⚪'} **${task.title}**\n${task.description.slice(0, 80)}${task.description.length > 80 ? '...' : ''}\n预估: ${task.estimated_effort}人天 | 标签: ${task.tags.join(', ')} | 建议: ${task.suggested_role}`,
    },
  }));

  const riskElements = result.risks.map((risk) => ({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `⚠️ **${risk.title}** [${risk.probability}概率/${risk.impact}影响]\n${risk.mitigation}`,
    },
  }));

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `📋 需求分析: ${result.requirement_summary}` },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `共 **${result.tasks.length}** 个任务 | 总预估 **${result.total_estimated_effort}** 人天 | 建议周期: ${result.suggested_timeline}`,
        },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: '**📌 任务列表**' },
      },
      ...taskElements,
      ...(riskElements.length > 0
        ? [
            { tag: 'hr' },
            { tag: 'div', text: { tag: 'lark_md', content: '**⚠️ 识别到的风险**' } },
            ...riskElements,
          ]
        : []),
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '✅ 确认并创建任务' },
            type: 'primary',
            value: { action: 'confirm_tasks', requirement_id: requirementId },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '✏️ 需要调整' },
            value: { action: 'edit_tasks', requirement_id: requirementId },
          },
        ],
      },
    ],
  };
}
