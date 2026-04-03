export const RiskProbability = ['High', 'Medium', 'Low'] as const;
export const RiskImpact = ['Critical', 'Major', 'Minor'] as const;
export const RiskStatus = ['Open', 'Mitigating', 'Resolved', 'Accepted'] as const;

export interface Risk {
  record_id?: string;
  title: string;
  description: string;
  probability: (typeof RiskProbability)[number];
  impact: (typeof RiskImpact)[number];
  status: (typeof RiskStatus)[number];
  mitigation_plan: string;
  owner?: string;
  identified_by?: string;
  target_resolution?: string;
}
