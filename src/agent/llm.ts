import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { ChatMessage, ToolDef, ToolCall } from './types.js';

const API_URL = (config.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/chat/completions';

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
}

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
}

export async function callLLM(
  messages: ChatMessage[],
  tools?: ToolDef[],
  maxTokens?: number,
): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model: config.LLM_MODEL,
    max_tokens: maxTokens || 4096,
    messages,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.ANTHROPIC_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('LLM API error', { status: res.status, body: text.slice(0, 500) });
    throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const choice = data.choices[0];

  return {
    content: choice?.message?.content || null,
    toolCalls: choice?.message?.tool_calls || [],
    finishReason: choice?.finish_reason || 'stop',
  };
}
