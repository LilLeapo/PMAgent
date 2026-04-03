import { callLLM } from './llm.js';
import { getSession, appendToSession } from './session.js';
import type { InboundMessage, ToolDef, ToolHandler, ChatMessage } from './types.js';
import { logger } from '../utils/logger.js';

interface AgentConfig {
  systemPrompt: string;
  tools: ToolDef[];
  handlers: Record<string, ToolHandler>;
  maxIterations: number;
}

/**
 * Core Agent Loop (ReAct pattern)
 *
 * 1. Build context: system prompt + session history + new user message
 * 2. Call LLM with tools
 * 3. If LLM returns text only → done, return text
 * 4. If LLM returns tool_calls → execute tools, append results, goto 2
 * 5. Repeat up to maxIterations
 */
export async function runLoop(
  msg: InboundMessage,
  agentConfig: AgentConfig,
): Promise<string> {
  const { systemPrompt, tools, handlers, maxIterations } = agentConfig;

  // Build user message
  let userContent = msg.text;
  if (msg.docUrls.length > 0) {
    userContent += `\n\n（飞书文档链接：${msg.docUrls.join(', ')}）`;
  }

  // Append user message to session
  appendToSession(msg.chatId, { role: 'user', content: userContent });

  // Build full context
  const session = getSession(msg.chatId);
  const context: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...session.messages,
  ];

  for (let i = 0; i < maxIterations; i++) {
    logger.debug('Agent loop iteration', { iteration: i, contextLength: context.length });

    const result = await callLLM(context, tools);

    // No tool calls → final response
    if (result.toolCalls.length === 0) {
      const reply = result.content || '(无回复)';
      appendToSession(msg.chatId, { role: 'assistant', content: reply });
      return reply;
    }

    // Append assistant message with tool calls
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: result.content || undefined,
      tool_calls: result.toolCalls,
    };
    context.push(assistantMsg);
    appendToSession(msg.chatId, assistantMsg);

    // Execute each tool call
    for (const toolCall of result.toolCalls) {
      const fnName = toolCall.function.name;
      const handler = handlers[fnName];

      let toolResult: string;
      if (!handler) {
        toolResult = JSON.stringify({ error: `未知工具: ${fnName}` });
        logger.warn('Unknown tool', { name: fnName });
      } else {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          logger.info('Tool call', { name: fnName, args: summarizeArgs(args) });
          toolResult = await handler(args);

          // Truncate long results to stay within context limits
          if (toolResult.length > 4000) {
            toolResult = toolResult.slice(0, 4000) + '\n...(结果已截断)';
          }
        } catch (err: any) {
          toolResult = JSON.stringify({ error: err.message || String(err) });
          logger.error('Tool failed', { name: fnName, error: err.message });
        }
      }

      const toolMsg: ChatMessage = {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      };
      context.push(toolMsg);
      appendToSession(msg.chatId, toolMsg);
    }
  }

  logger.warn('Agent loop hit max iterations');
  const fallback = '操作步骤过多，请简化请求再试。';
  appendToSession(msg.chatId, { role: 'assistant', content: fallback });
  return fallback;
}

/** Summarize args for logging (avoid dumping huge payloads) */
function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v.length > 100) {
      summary[k] = v.slice(0, 100) + '...';
    } else {
      summary[k] = v;
    }
  }
  return summary;
}
