import type { ParsedMessage } from '../gateway/message-parser.js';
import { runAgentLoop } from '../agents/agent-loop.js';
import { PM_TOOLS, PM_TOOL_HANDLERS } from '../agents/tools.js';
import { SKILL_TOOLS, SKILL_TOOL_HANDLERS, SKILL_PROMPT_SECTION } from '../agents/skills.js';
import * as messaging from '../services/messaging.service.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `你是一个部署在飞书里的AI项目管理助手（PM Agent）。你的名字叫PMBot。

你的核心能力：
1. **任务拆解** — 用户描述需求时，调用 decompose_requirement 工具拆解为可执行的工程任务
2. **迭代管理** — 创建Sprint、查看进度、关闭迭代
3. **风险管理** — 记录风险、查看风险报告
4. **文档解析** — 可以读取飞书文档内容并分析
5. **飞书平台操作** — 通过 lark_cli 工具直接操作飞书平台（多维表格、任务、消息、文档、日历等）

${SKILL_PROMPT_SECTION}

使用规则：
- 当用户描述功能需求、发PRD链接时，用 decompose_requirement 拆解任务
- 当用户问迭代进度时，用 get_cycle_status
- 当用户提到风险时，用 add_risk 或 get_risk_report
- 当用户发飞书文档链接时，先用 fetch_feishu_doc 获取内容
- 当用户要求操作飞书平台（查表、发消息、建任务等）时，用 lark_cli 工具
- 当用户只是闲聊、打招呼、问问题时，直接回复，不需要调用工具

回复规则：
- 用中文回复
- 简洁友好，像一个靠谱的同事
- 调用工具后，用自然语言总结结果给用户，不要直接返回JSON`;

// Merge PM tools and Skill tools
const ALL_TOOLS = [...PM_TOOLS, ...SKILL_TOOLS];
const ALL_HANDLERS = { ...PM_TOOL_HANDLERS, ...SKILL_TOOL_HANDLERS };

export async function handleMessage(msg: ParsedMessage): Promise<void> {
  const { text, messageId, feishuDocUrls } = msg;

  try {
    // Build user message with doc URLs if present
    let userMessage = text;
    if (feishuDocUrls.length > 0) {
      userMessage += `\n\n（消息中包含的飞书文档链接：${feishuDocUrls.join(', ')}）`;
    }

    // Run ReAct agent loop — one LLM call handles both intent and response
    const reply = await runAgentLoop(userMessage, {
      systemPrompt: SYSTEM_PROMPT,
      tools: ALL_TOOLS,
      toolHandlers: ALL_HANDLERS,
      maxIterations: 5,
    });

    await messaging.replyText(messageId, reply);
  } catch (err) {
    logger.error('Error handling message', { error: err, text });
    await messaging.replyText(messageId, '处理消息时出错了，请稍后重试。').catch(() => {});
  }
}
