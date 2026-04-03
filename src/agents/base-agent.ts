import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const API_URL = (config.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/chat/completions';
const API_KEY = config.ANTHROPIC_API_KEY;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function chatCompletion(
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  return data.choices[0]?.message?.content || '';
}

export async function callLLM<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodSchema<T>;
  maxTokens?: number;
  maxRetries?: number;
}): Promise<T> {
  const { system, user, schema, maxTokens = 4096, maxRetries = 2 } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const text = await chatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens,
    );

    const jsonStr = extractJson(text);
    if (!jsonStr) {
      logger.warn('No JSON found in LLM response', { attempt, text: text.slice(0, 200) });
      if (attempt < maxRetries) continue;
      throw new Error('LLM did not return valid JSON');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed);
    } catch (err) {
      logger.warn('JSON parse/validation failed', { attempt, error: err });
      if (attempt < maxRetries) continue;
      throw err;
    }
  }

  throw new Error('LLM call exhausted retries');
}

export async function callLLMText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  return chatCompletion(
    [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    opts.maxTokens || 2048,
  );
}

function extractJson(text: string): string | null {
  // Try ```json ... ``` block first
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();

  // Try raw JSON object/array
  const braceStart = text.indexOf('{');
  const bracketStart = text.indexOf('[');
  const start = braceStart >= 0 && (bracketStart < 0 || braceStart < bracketStart)
    ? braceStart : bracketStart;
  if (start < 0) return null;

  const opener = text[start];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === opener) depth++;
    if (text[i] === closer) depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}
