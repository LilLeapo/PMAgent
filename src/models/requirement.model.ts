export const RequirementSourceType = ['Chat Message', 'PRD Document', 'Feishu Doc'] as const;
export const RequirementStatus = ['New', 'Analyzed', 'Decomposed', 'Rejected'] as const;

export interface Requirement {
  record_id?: string;
  title: string;
  raw_input: string;
  source_type: (typeof RequirementSourceType)[number];
  source_url?: string;
  status: (typeof RequirementStatus)[number];
  requester?: string;
  analysis_notes?: string;
}
