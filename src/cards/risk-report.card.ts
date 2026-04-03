export function buildRiskReportCard(report: string, riskCount: number) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `⚠️ 风险报告 (${riskCount}项未解决)` },
      template: riskCount > 5 ? 'red' : riskCount > 2 ? 'orange' : 'yellow',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: report },
      },
    ],
  };
}
