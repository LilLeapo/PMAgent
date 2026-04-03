import type { Skill } from '../../agent/types.js';
import { execLarkCli } from '../shared.js';

export const larkTaskSkill: Skill = {
  name: 'lark-task',
  description: '飞书任务管理：创建、分配、完成、查询任务',

  tools: [
    {
      type: 'function',
      function: {
        name: 'lark_task',
        description: `操作飞书任务。常用命令：
- +create --title "标题" --description "描述"  创建任务
- +assign --task-id <id> --user-id <uid>  分配任务
- +complete --task-id <id>  完成任务
- +reopen --task-id <id>  重新打开
- +update --task-id <id> --title "新标题"  更新任务
- +reminder --task-id <id> --time "2026-04-10T10:00:00"  设置提醒
- +get-my-tasks  查看我的任务
结果中的 url 字段可直接点击跳转到飞书。`,
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '完整的 task 子命令' },
          },
          required: ['command'],
        },
      },
    },
  ],

  handlers: {
    lark_task: (args) => execLarkCli('task', args.command as string),
  },

  systemPromptSection: `### 任务管理（lark-task）
通过 lark_task 工具管理飞书任务：创建并分配任务、设置提醒和截止日期、查看和完成任务。
- 创建任务后记得提取返回的 url 给用户
- "me" 会自动解析为当前用户ID`,
};
