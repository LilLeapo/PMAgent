// Table IDs are populated by scripts/setup-bitable.ts
// After running setup, update these values with the actual table IDs
export const tableIds = {
  tasks: process.env.TABLE_ID_TASKS || '',
  cycles: process.env.TABLE_ID_CYCLES || '',
  risks: process.env.TABLE_ID_RISKS || '',
  requirements: process.env.TABLE_ID_REQUIREMENTS || '',
  activityLog: process.env.TABLE_ID_ACTIVITY_LOG || '',
};
