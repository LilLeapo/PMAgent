import type { ToolDefinition } from './base-agent.js';
import type { ToolHandler } from './agent-loop.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Feishu CLI Skills — expose lark-cli commands as LLM tools.
 *
 * The LLM can execute lark-cli commands to interact with Feishu platform:
 * - lark-base: multi-dimensional tables (bitable)
 * - lark-task: task management
 * - lark-im: messaging
 * - lark-doc: document operations
 * - lark-calendar: calendar management
 */

export const SKILL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'lark_cli',
      description: `执行 lark-cli 命令与飞书平台交互。支持的服务和常用命令：

【多维表格 lark-base】
- lark-cli base +table-get --app-token <token>  获取表信息
- lark-cli base +record-list --app-token <token> --table-id <id>  列出记录
- lark-cli base +record-upsert --app-token <token> --table-id <id> --data '{"fields":{...}}'  创建/更新记录
- lark-cli base +field-list --app-token <token> --table-id <id>  列出字段
- lark-cli base +data-query --app-token <token> --table-id <id> --group-by <field> --agg 'SUM(field)'  数据聚合

【任务 lark-task】
- lark-cli task +create --title "标题" --description "描述"  创建任务
- lark-cli task +assign --task-id <id> --user-id <uid>  分配任务
- lark-cli task +complete --task-id <id>  完成任务
- lark-cli task +get-my-tasks  查看我的任务

【消息 lark-im】
- lark-cli im +messages-send --chat-id <id> --text "内容"  发消息
- lark-cli im +messages-reply --message-id <id> --text "内容"  回复消息
- lark-cli im +chat-messages-list --chat-id <id>  查看消息记录

【文档 lark-doc】
- lark-cli doc search --keywords "关键词"  搜索文档
- lark-cli doc fetch --document-id <id>  获取文档内容

【日历 lark-calendar】
- lark-cli calendar +agenda  查看日程

注意：写操作前要确认，用 --dry-run 预览。输出为JSON格式。`,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '完整的 lark-cli 命令（不含 lark-cli 前缀），如 "base +record-list --app-token xxx --table-id xxx"',
          },
          dry_run: {
            type: 'boolean',
            description: '是否用 --dry-run 预览（写操作建议先预览）',
          },
        },
        required: ['command'],
      },
    },
  },
];

export const SKILL_TOOL_HANDLERS: Record<string, ToolHandler> = {
  async lark_cli(args) {
    let command = args.command as string;
    const dryRun = args.dry_run as boolean;

    // Security: block dangerous patterns
    if (/[;&|`$]/.test(command)) {
      return JSON.stringify({ error: '命令包含不安全字符' });
    }

    if (dryRun && !command.includes('--dry-run')) {
      command += ' --dry-run';
    }

    const fullCommand = `lark-cli ${command}`;
    logger.info('Executing lark-cli', { command: fullCommand });

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });

      const output = stdout || stderr;
      logger.info('lark-cli result', { length: output.length });
      return output || '(无输出)';
    } catch (err: any) {
      const errorOutput = err.stderr || err.stdout || err.message;
      logger.error('lark-cli failed', { error: errorOutput });
      return JSON.stringify({ error: errorOutput?.slice(0, 2000) || String(err) });
    }
  },
};

/** Skill descriptions to include in system prompt */
export const SKILL_PROMPT_SECTION = `
## 飞书CLI能力（lark-cli）

你可以通过 lark_cli 工具执行飞书CLI命令，直接操作飞书平台。以下是你可以使用的能力：

### 多维表格（Base/Bitable）
- 查看表结构和字段
- 创建、更新、删除记录
- 数据查询和聚合分析（SUM/AVG/COUNT/GROUP BY）
- 管理视图和仪表盘

### 任务管理（Task）
- 创建任务并分配给团队成员
- 设置截止日期和提醒
- 查询任务状态、完成任务
- 管理子任务和关注者

### 消息通知（IM）
- 发送消息到群聊或个人
- 回复消息
- 创建群聊
- 查看消息记录

### 文档（Doc）
- 搜索和获取飞书文档内容
- 创建和更新文档

### 日历（Calendar）
- 查看团队成员日程
- 安排会议时间

使用原则：
1. 优先使用快捷命令（+verb格式），如 base +record-list
2. 写操作前建议先用 --dry-run 预览
3. 输出为JSON格式，解析后用自然语言总结给用户
`;
