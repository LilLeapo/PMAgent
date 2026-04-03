import type { Skill } from '../agent/types.js';
import { callLLM } from '../agent/llm.js';
import { TASK_DECOMPOSITION_SYSTEM_PROMPT } from '../agents/prompts/task-decomposition.js';

/**
 * Built-in PM tools that don't depend on lark-cli.
 * These use LLM for reasoning (task decomposition, risk analysis).
 */
export const pmToolsSkill: Skill = {
  name: 'pm-tools',
  description: '项目管理核心能力：需求拆解、风险分析',

  tools: [
    {
      type: 'function',
      function: {
        name: 'decompose_requirement',
        description: '将需求拆解为可执行的工程任务。当用户描述新功能、新需求或发送PRD时使用。返回任务列表、风险和估时。',
        parameters: {
          type: 'object',
          properties: {
            requirement: { type: 'string', description: '完整的需求描述' },
          },
          required: ['requirement'],
        },
      },
    },
  ],

  handlers: {
    async decompose_requirement(args) {
      const requirement = args.requirement as string;

      const result = await callLLM(
        [
          { role: 'system', content: TASK_DECOMPOSITION_SYSTEM_PROMPT },
          { role: 'user', content: `用户需求：\n${requirement}` },
        ],
        undefined,
        8192,
      );

      return result.content || '无法拆解该需求';
    },
  },

  systemPromptSection: `### 需求拆解（pm-tools）
当用户描述功能需求或发PRD时，用 decompose_requirement 工具将其拆解为可执行的工程任务、识别风险并估算工时。
拆解结果出来后，可以用 lark_task 创建飞书任务，用 lark_base 写入多维表格。`,
};
