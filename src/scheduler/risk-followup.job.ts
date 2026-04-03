import * as riskAnalyzer from '../agents/risk-analyzer.js';
import * as cycleManager from '../agents/cycle-manager.js';
import * as messaging from '../services/messaging.service.js';
import { logger } from '../utils/logger.js';

export async function runRiskFollowup(): Promise<void> {
  // Check risks approaching deadline
  const urgentRisks = await riskAnalyzer.getRisksNearDeadline(3);

  for (const risk of urgentRisks) {
    const owner = risk.fields['负责人'] as Array<{ id: string }>;
    if (owner?.[0]) {
      await messaging.sendDM(
        owner[0].id,
        `⚠️ 风险提醒：「${risk.fields['标题']}」的目标解决日期即将到来，当前状态: ${risk.fields['状态']}。请及时更新。`,
      );
    }
  }

  // Escalate high-risk items that are stale (open for > 3 days)
  const openRisks = await riskAnalyzer.getOpenRisks();
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

  const staleHighRisks = openRisks.filter(r => {
    const created = r.fields['创建时间'] as number;
    const prob = r.fields['概率'] as string;
    const impact = r.fields['影响'] as string;
    return (
      prob === 'High' &&
      impact === 'Critical' &&
      created &&
      created < threeDaysAgo &&
      r.fields['状态'] === 'Open'
    );
  });

  if (staleHighRisks.length > 0) {
    const activeCycle = await cycleManager.getActiveCycle();
    const cycleOwner = activeCycle?.fields['负责人'] as Array<{ id: string }>;

    if (cycleOwner?.[0]) {
      const riskNames = staleHighRisks.map(r => `• ${r.fields['标题']}`).join('\n');
      await messaging.sendDM(
        cycleOwner[0].id,
        `🔴 风险升级通知：以下高危风险已超过3天未处理：\n${riskNames}\n\n请立即介入。`,
      );
    }
  }

  logger.info('Risk followup completed', {
    urgent: urgentRisks.length,
    staleHigh: staleHighRisks.length,
  });
}
