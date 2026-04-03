import { chatCompletion, type ChatMessage } from './base-agent.js';
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

  const messages: ChatMessage[] = [
    { role: 'system', content: TASK_DECOMPOSITION_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await chatCompletion(messages, { maxTokens: 8192 });
    const text = result.content || '';

    const jsonStr = extractJson(text);
    if (!jsonStr) {
      logger.warn('No JSON in decomposition response', { attempt });
      continue;
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return DecompositionResultSchema.parse(parsed) as DecompositionResult;
    } catch (err) {
      logger.warn('Decomposition JSON validation failed', { attempt, error: err });
    }
  }

  throw new Error('Failed to decompose requirement after retries');
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();

  const braceStart = text.indexOf('{');
  if (braceStart < 0) return null;

  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') depth--;
    if (depth === 0) return text.slice(braceStart, i + 1);
  }
  return null;
}
