import { client } from './feishu-client.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const APP_TOKEN = config.BITABLE_APP_TOKEN;

export interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

export async function createRecord(
  tableId: string,
  fields: Record<string, any>,
): Promise<BitableRecord> {
  const res = await client.bitable.appTableRecord.create({
    path: { app_token: APP_TOKEN, table_id: tableId },
    data: { fields: fields as any },
  });
  return res.data?.record as BitableRecord;
}

export async function batchCreateRecords(
  tableId: string,
  records: Array<{ fields: Record<string, any> }>,
): Promise<BitableRecord[]> {
  const res = await client.bitable.appTableRecord.batchCreate({
    path: { app_token: APP_TOKEN, table_id: tableId },
    data: { records: records as any },
  });
  return (res.data?.records as BitableRecord[]) || [];
}

export async function updateRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, any>,
): Promise<BitableRecord> {
  const res = await client.bitable.appTableRecord.update({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
    data: { fields: fields as any },
  });
  return res.data?.record as BitableRecord;
}

export async function getRecord(
  tableId: string,
  recordId: string,
): Promise<BitableRecord> {
  const res = await client.bitable.appTableRecord.get({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  });
  return res.data?.record as BitableRecord;
}

export async function searchRecords(
  tableId: string,
  filter?: {
    conjunction: 'and' | 'or';
    conditions: Array<{
      field_name: string;
      operator: 'is' | 'isNot' | 'contains' | 'doesNotContain' | 'isEmpty' | 'isNotEmpty' | 'isGreater' | 'isLess';
      value?: string[];
    }>;
  },
  sort?: Array<{ field_name: string; desc?: boolean }>,
  pageSize?: number,
): Promise<BitableRecord[]> {
  const allRecords: BitableRecord[] = [];
  let pageToken: string | undefined;

  do {
    const res = await client.bitable.appTableRecord.search({
      path: { app_token: APP_TOKEN, table_id: tableId },
      params: { page_size: pageSize || 100, ...(pageToken ? { page_token: pageToken } : {}) },
      data: {
        filter,
        sort,
        automatic_fields: true,
      },
    });
    const items = (res.data?.items as BitableRecord[]) || [];
    allRecords.push(...items);
    pageToken = res.data?.page_token || undefined;
  } while (pageToken);

  return allRecords;
}

export async function deleteRecord(tableId: string, recordId: string): Promise<void> {
  await client.bitable.appTableRecord.delete({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  });
}

export async function listTables(): Promise<Array<{ table_id: string; name: string }>> {
  const res = await client.bitable.appTable.list({
    path: { app_token: APP_TOKEN },
  });
  return (res.data?.items as Array<{ table_id: string; name: string }>) || [];
}

export async function createTable(name: string, fields: Array<{
  field_name: string;
  type: number;
  property?: object;
}>): Promise<string> {
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
  logger.info('Created table', { name, tableId: res.data?.table_id });
  return res.data?.table_id as string;
}
