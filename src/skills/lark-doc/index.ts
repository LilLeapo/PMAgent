import type { Skill } from '../../agent/types.js';
import { execLarkCli } from '../shared.js';

export const larkDocSkill: Skill = {
  name: 'lark-doc',
  description: '飞书文档：搜索、读取、创建和更新文档',

  tools: [
    {
      type: 'function',
      function: {
        name: 'lark_doc',
        description: `操作飞书文档。常用命令：
- search --keywords "关键词"  搜索文档
- fetch --document-id <id>  获取文档内容（Markdown格式）
- create --title "标题" --content "# 内容"  创建文档
- update --document-id <id> --content "新内容"  更新文档
注意：wiki 链接需要先用 wiki.spaces.get_node 获取实际 document_id。`,
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '完整的 doc 子命令' },
          },
          required: ['command'],
        },
      },
    },
  ],

  handlers: {
    lark_doc: (args) => execLarkCli('doc', args.command as string),
  },

  systemPromptSection: `### 文档操作（lark-doc）
通过 lark_doc 工具操作飞书文档：搜索文档、读取PRD内容、创建会议纪要等。`,
};
