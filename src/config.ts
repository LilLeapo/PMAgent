import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  FEISHU_APP_ID: z.string().min(1),
  FEISHU_APP_SECRET: z.string().min(1),
  FEISHU_BASE_URL: z.string().optional(),  // e.g. https://open.feishu.cn or https://open.larksuite.com
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_BASE_URL: z.string().optional(), // e.g. https://your-proxy.com/v1
  LLM_MODEL: z.string().default('claude-sonnet-4-20250514'),
  BITABLE_APP_TOKEN: z.string().default(''),
  BOT_NAME: z.string().default('PMBot'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  STANDUP_CRON: z.string().default('0 10 * * 1-5'),
  RISK_REVIEW_CRON: z.string().default('0 10 * * 1'),
  STALE_TASK_DAYS: z.coerce.number().default(3),
  BLOCKED_TASK_HOURS: z.coerce.number().default(24),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
