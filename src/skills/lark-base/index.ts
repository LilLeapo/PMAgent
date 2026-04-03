import type { Skill } from '../../agent/types.js';
import { execLarkCli } from '../shared.js';

export const larkBaseSkill: Skill = {
  name: 'lark-base',
  description: '飞书多维表格（Bitable）操作：表管理、记录CRUD、数据查询聚合',

  tools: [
    {
      type: 'function',
      function: {
        name: 'lark_base',
        description: `操作飞书多维表格。常用命令：
- +table-get --app-token <t>  查看表信息
- +field-list --app-token <t> --table-id <id>  查看字段
- +record-list --app-token <t> --table-id <id>  列出记录
- +record-upsert --app-token <t> --table-id <id> --data '{"fields":{...}}'  创建/更新记录
- +data-query --app-token <t> --table-id <id> --group-by <field> --agg 'SUM(field)'  聚合查询
写操作建议先用 --dry-run 预览。`,
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '完整的 base 子命令，如 "+record-list --app-token xxx --table-id xxx"' },
          },
          required: ['command'],
        },
      },
    },
  ],

  handlers: {
    lark_base: (args) => execLarkCli('base', args.command as string),
  },

  systemPromptSection: `### 多维表格（lark-base）
通过 lark_base 工具操作飞书多维表格：查看表结构、增删改查记录、数据聚合分析。
- 优先用快捷命令（+verb格式）
- 聚合查询用 +data-query，不要用 +record-list
- 写操作前建议 --dry-run 预览`,
};
