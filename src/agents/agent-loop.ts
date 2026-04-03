import { chatCompletion, type ChatMessage, type ToolDefinition, type ToolCall } from './base-agent.js';
import { logger } from '../utils/logger.js';

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

interface AgentLoopOpts {
  systemPrompt: string;
  tools: ToolDefinition[];
  toolHandlers: Record<string, ToolHandler>;
  maxIterations?: number;
}

/**
 * ReAct agent loop: send message to LLM with tools,
 * execute tool calls, feed results back, repeat until LLM returns text.
 */
export async function runAgentLoop(
  userMessage: string,
  opts: AgentLoopOpts,
): Promise<string> {
  const { systemPrompt, tools, toolHandlers, maxIterations = 10 } = opts;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  for (let i = 0; i < maxIterations; i++) {
    const result = await chatCompletion(messages, { tools });

    // If LLM returns text without tool calls, we're done
    if (result.toolCalls.length === 0) {
      return result.content || '(无回复)';
    }

    // Append assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: result.content || undefined,
      tool_calls: result.toolCalls,
    });

    // Execute each tool call and append results
    for (const toolCall of result.toolCalls) {
      const fnName = toolCall.function.name;
      const handler = toolHandlers[fnName];

      let toolResult: string;
      if (!handler) {
        toolResult = JSON.stringify({ error: `Unknown tool: ${fnName}` });
        logger.warn('Unknown tool called', { name: fnName });
      } else {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          logger.info('Executing tool', { name: fnName, args });
          toolResult = await handler(args);
          // Truncate very long results
          if (toolResult.length > 4000) {
            toolResult = toolResult.slice(0, 4000) + '\n...(结果已截断)';
          }
        } catch (err: any) {
          toolResult = JSON.stringify({ error: err.message || String(err) });
          logger.error('Tool execution failed', { name: fnName, error: err });
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  // If we hit max iterations, return whatever we have
  logger.warn('Agent loop hit max iterations', { maxIterations });
  return '处理步骤过多，请尝试简化你的请求。';
}
