/**
 * Run this script to create all required Bitable tables.
 * Usage: npx tsx scripts/setup-bitable.ts
 *
 * After running, copy the output table IDs into your .env file.
 */
import 'dotenv/config';
import { client } from '../src/services/feishu-client.js';
import { config } from '../src/config.js';

const APP_TOKEN = config.BITABLE_APP_TOKEN;

// Field type constants (Feishu Bitable API)
const FieldType = {
  Text: 1,
  Number: 2,
  SingleSelect: 3,
  MultiSelect: 4,
  DateTime: 5,
  Checkbox: 7,
  Person: 11,
  URL: 15,
  AutoNumber: 1005,
  CreatedTime: 1001,
  ModifiedTime: 1002,
  CreatedBy: 1003,
  Link: 18,
  Formula: 20,
} as const;

async function createTableWithFields(
  name: string,
  fields: Array<{ field_name: string; type: number; property?: any }>,
): Promise<string> {
  const res = await client.bitable.appTable.create({
    path: { app_token: APP_TOKEN },
    data: {
      table: {
        name,
        default_view_name: '默认视图',
        fields,
      },
    },
  });

  const tableId = res.data?.table_id as string;
  console.log(`✅ Created table "${name}": ${tableId}`);
  return tableId;
}

async function main() {
  console.log('Setting up Bitable tables...\n');

  // 1. Tasks table
  const tasksTableId = await createTableWithFields('任务', [
    { field_name: '标题', type: FieldType.Text },
    { field_name: '描述', type: FieldType.Text },
    {
      field_name: '状态',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'Backlog', color: 0 },
          { name: 'Todo', color: 1 },
          { name: 'In Progress', color: 2 },
          { name: 'In Review', color: 3 },
          { name: 'Done', color: 4 },
          { name: 'Blocked', color: 5 },
        ],
      },
    },
    {
      field_name: '优先级',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'P0-Critical', color: 5 },
          { name: 'P1-High', color: 6 },
          { name: 'P2-Medium', color: 1 },
          { name: 'P3-Low', color: 0 },
        ],
      },
    },
    { field_name: '负责人', type: FieldType.Person },
    { field_name: '来源需求', type: FieldType.Text },
    { field_name: '预估工时', type: FieldType.Number },
    { field_name: '截止日期', type: FieldType.DateTime },
    {
      field_name: '标签',
      type: FieldType.MultiSelect,
      property: {
        options: [
          { name: 'frontend', color: 0 },
          { name: 'backend', color: 1 },
          { name: 'design', color: 2 },
          { name: 'infra', color: 3 },
          { name: 'testing', color: 4 },
        ],
      },
    },
    { field_name: '备注', type: FieldType.Text },
    { field_name: '创建时间', type: FieldType.CreatedTime },
    { field_name: '更新时间', type: FieldType.ModifiedTime },
  ]);

  // 2. Cycles table
  const cyclesTableId = await createTableWithFields('迭代', [
    { field_name: '名称', type: FieldType.Text },
    {
      field_name: '状态',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'Planning', color: 0 },
          { name: 'Active', color: 2 },
          { name: 'Completed', color: 4 },
          { name: 'Cancelled', color: 5 },
        ],
      },
    },
    { field_name: '开始日期', type: FieldType.DateTime },
    { field_name: '结束日期', type: FieldType.DateTime },
    { field_name: '目标', type: FieldType.Text },
    { field_name: '负责人', type: FieldType.Person },
    { field_name: '回顾', type: FieldType.Text },
    { field_name: '通知群', type: FieldType.Text },
    { field_name: '创建时间', type: FieldType.CreatedTime },
  ]);

  // 3. Risks table
  const risksTableId = await createTableWithFields('风险', [
    { field_name: '标题', type: FieldType.Text },
    { field_name: '描述', type: FieldType.Text },
    {
      field_name: '概率',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'High', color: 5 },
          { name: 'Medium', color: 1 },
          { name: 'Low', color: 0 },
        ],
      },
    },
    {
      field_name: '影响',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'Critical', color: 5 },
          { name: 'Major', color: 6 },
          { name: 'Minor', color: 0 },
        ],
      },
    },
    {
      field_name: '状态',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'Open', color: 5 },
          { name: 'Mitigating', color: 1 },
          { name: 'Resolved', color: 4 },
          { name: 'Accepted', color: 0 },
        ],
      },
    },
    { field_name: '缓解方案', type: FieldType.Text },
    { field_name: '负责人', type: FieldType.Person },
    { field_name: '发现人', type: FieldType.Person },
    { field_name: '目标解决日期', type: FieldType.DateTime },
    { field_name: '创建时间', type: FieldType.CreatedTime },
    { field_name: '更新时间', type: FieldType.ModifiedTime },
  ]);

  // 4. Requirements table
  const requirementsTableId = await createTableWithFields('需求', [
    { field_name: '标题', type: FieldType.Text },
    { field_name: '原始输入', type: FieldType.Text },
    {
      field_name: '来源类型',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'Chat Message', color: 0 },
          { name: 'PRD Document', color: 1 },
          { name: 'Feishu Doc', color: 2 },
        ],
      },
    },
    { field_name: '来源链接', type: FieldType.URL },
    {
      field_name: '状态',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'New', color: 0 },
          { name: 'Analyzed', color: 1 },
          { name: 'Decomposed', color: 4 },
          { name: 'Rejected', color: 5 },
        ],
      },
    },
    { field_name: '提交人', type: FieldType.Person },
    { field_name: '分析备注', type: FieldType.Text },
    { field_name: '创建时间', type: FieldType.CreatedTime },
  ]);

  // 5. Activity Log table
  const activityLogTableId = await createTableWithFields('操作日志', [
    { field_name: '操作', type: FieldType.Text },
    { field_name: '操作人', type: FieldType.Person },
    {
      field_name: '实体类型',
      type: FieldType.SingleSelect,
      property: {
        options: [
          { name: 'Task', color: 0 },
          { name: 'Cycle', color: 1 },
          { name: 'Risk', color: 2 },
          { name: 'Requirement', color: 3 },
        ],
      },
    },
    { field_name: '实体ID', type: FieldType.Text },
    { field_name: '详情', type: FieldType.Text },
    { field_name: '时间', type: FieldType.CreatedTime },
  ]);

  // Output env config
  console.log('\n========================================');
  console.log('Add these to your .env file:\n');
  console.log(`TABLE_ID_TASKS=${tasksTableId}`);
  console.log(`TABLE_ID_CYCLES=${cyclesTableId}`);
  console.log(`TABLE_ID_RISKS=${risksTableId}`);
  console.log(`TABLE_ID_REQUIREMENTS=${requirementsTableId}`);
  console.log(`TABLE_ID_ACTIVITY_LOG=${activityLogTableId}`);
  console.log('========================================');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
