import { chatCompletion } from './base-agent.js';
import { RISK_REPORT_SYSTEM_PROMPT } from './prompts/risk-analysis.js';
import * as bitable from '../services/bitable.service.js';
import { tableIds } from '../repositories/table-ids.js';
import type { Risk } from '../models/risk.model.js';
import { logger } from '../utils/logger.js';

export async function addRisk(risk: Omit<Risk, 'record_id'>): Promise<string> {
  const record = await bitable.createRecord(tableIds.risks, {
    '标题': risk.title,
    '描述': risk.description,
    '概率': risk.probability,
    '影响': risk.impact,
    '状态': risk.status,
    '缓解方案': risk.mitigation_plan,
    ...(risk.owner ? { '负责人': [{ id: risk.owner }] } : {}),
    ...(risk.identified_by ? { '发现人': [{ id: risk.identified_by }] } : {}),
  });
  logger.info('Created risk', { title: risk.title, recordId: record.record_id });
  return record.record_id;
}

export async function getOpenRisks(): Promise<bitable.BitableRecord[]> {
  return bitable.searchRecords(tableIds.risks, {
    conjunction: 'or',
    conditions: [
      { field_name: '状态', operator: 'is', value: ['Open'] },
      { field_name: '状态', operator: 'is', value: ['Mitigating'] },
    ],
  });
}

export async function generateRiskReport(): Promise<string> {
  const risks = await getOpenRisks();

  if (risks.length === 0) {
    return '当前没有未解决的风险。';
  }

  const data = JSON.stringify(risks.map(r => ({
    title: r.fields['标题'],
    description: r.fields['描述'],
    probability: r.fields['概率'],
    impact: r.fields['影响'],
    status: r.fields['状态'],
    owner: r.fields['负责人'],
    mitigation: r.fields['缓解方案'],
    target_date: r.fields['目标解决日期'],
  })));

  const res = await chatCompletion([
    { role: 'system', content: RISK_REPORT_SYSTEM_PROMPT },
    { role: 'user', content: data },
  ]);
  return res.content || '';
}

export async function getRisksNearDeadline(daysAhead: number = 3): Promise<bitable.BitableRecord[]> {
  const risks = await getOpenRisks();
  const cutoff = Date.now() + daysAhead * 24 * 60 * 60 * 1000;

  return risks.filter(r => {
    const target = r.fields['目标解决日期'] as number;
    return target && target <= cutoff;
  });
}
