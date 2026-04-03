/** Message from channel to agent */
export interface InboundMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  chatType: 'p2p' | 'group';
  mentionedUserIds: string[];
  docUrls: string[];
  timestamp: number;
}

/** Message from agent to channel */
export interface OutboundMessage {
  chatId: string;
  replyToMessageId?: string;
  text: string;
}

/** Tool definition for LLM (OpenAI-compatible) */
export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

/** Tool call from LLM response */
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** Chat message for LLM context */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/** Tool handler function */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

/** Skill definition */
export interface Skill {
  name: string;
  description: string;
  tools: ToolDef[];
  handlers: Record<string, ToolHandler>;
  /** Extra system prompt content for this skill */
  systemPromptSection?: string;
}

/** Session — conversation history per chat */
export interface Session {
  chatId: string;
  messages: ChatMessage[];
  lastActive: number;
}
