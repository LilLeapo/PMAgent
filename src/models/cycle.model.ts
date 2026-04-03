export const CycleStatus = ['Planning', 'Active', 'Completed', 'Cancelled'] as const;

export interface Cycle {
  record_id?: string;
  name: string;
  status: (typeof CycleStatus)[number];
  start_date: string;
  end_date: string;
  goal: string;
  owner?: string; // open_id
}
