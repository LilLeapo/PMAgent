export function buildCycleStatusCard(
  cycleName: string,
  statusSummary: string,
  stats: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    totalEffort: number;
    doneEffort: number;
    daysLeft: number;
  },
) {
  const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const effortPercent = stats.totalEffort > 0 ? Math.round((stats.doneEffort / stats.totalEffort) * 100) : 0;

  const bar = (pct: number) => {
    const filled = Math.round(pct / 5);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
  };

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `📊 ${cycleName} 进度` },
      template: stats.blocked > 0 ? 'red' : progressPercent >= 80 ? 'green' : 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            `**任务进度**: ${bar(progressPercent)} ${progressPercent}% (${stats.done}/${stats.total})`,
            `**工时进度**: ${bar(effortPercent)} ${effortPercent}% (${stats.doneEffort}/${stats.totalEffort}人天)`,
            `**剩余天数**: ${stats.daysLeft}天`,
            stats.inProgress > 0 ? `**进行中**: ${stats.inProgress}个任务` : '',
            stats.blocked > 0 ? `**🚫 阻塞**: ${stats.blocked}个任务` : '',
          ].filter(Boolean).join('\n'),
        },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: statusSummary },
      },
    ],
  };
}
