import { z } from 'zod';
import { chatCompletion } from '../agents/base-agent.js';
import { INTENT_SYSTEM_PROMPT } from '../agents/prompts/intent-detection.js';

export const IntentSchema = z.object({
  intent: z.enum([
    'decompose_task',
    'cycle_create',
    'cycle_add_tasks',
    'cycle_status',
    'cycle_close',
    'risk_add',
    'risk_report',
    'task_assign',
    'task_status',
    'task_update',
    'help',
    'unknown',
  ]),
  entities: z.object({
    task_ids: z.array(z.string()).default([]),
    cycle_name: z.string().optional().default(''),
    assignee_names: z.array(z.string()).default([]),
    status: z.string().optional().default(''),
    risk_description: z.string().optional().default(''),
    doc_urls: z.array(z.string()).default([]),
    raw_requirement: z.string().optional().default(''),
  }),
  confidence: z.number(),
});

export type Intent = z.infer<typeof IntentSchema>;

export async function detectIntent(text: string, docUrls: string[]): Promise<Intent> {
  const prompt = docUrls.length > 0
    ? `用户消息：${text}\n\n消息中包含的飞书文档链接：${docUrls.join(', ')}`
    : `用户消息：${text}`;

  const res = await chatCompletion([
    { role: 'system', content: INTENT_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ], { maxTokens: 1024 });

  const parsed = JSON.parse(res.content || '{}');
  return IntentSchema.parse(parsed);
}
