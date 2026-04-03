import { callLLM } from './base-agent.js';
import { TASK_DECOMPOSITION_SYSTEM_PROMPT } from './prompts/task-decomposition.js';
import { DecompositionResultSchema, type DecompositionResult } from '../models/task.model.js';
import { fetchDocFromUrl } from '../services/document.service.js';
import { logger } from '../utils/logger.js';

export async function decomposeRequirement(
  rawInput: string,
  docUrls: string[] = [],
): Promise<DecompositionResult> {
  // Fetch any linked documents
  const docContents: string[] = [];
  for (const url of docUrls) {
    const content = await fetchDocFromUrl(url);
    if (content) {
      docContents.push(`\n--- 文档内容 (${url}) ---\n${content}\n--- 文档结束 ---\n`);
    }
  }

  const userPrompt = docContents.length > 0
    ? `用户需求：\n${rawInput}\n\n参考文档：\n${docContents.join('\n')}`
    : `用户需求：\n${rawInput}`;

  logger.info('Decomposing requirement', { inputLength: userPrompt.length, docCount: docUrls.length });

  return callLLM({
    system: TASK_DECOMPOSITION_SYSTEM_PROMPT,
    user: userPrompt,
    schema: DecompositionResultSchema as any,
    maxTokens: 8192,
  }) as Promise<DecompositionResult>;
}
