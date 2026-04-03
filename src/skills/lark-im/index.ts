import type { Skill } from '../../agent/types.js';
import { execLarkCli } from '../shared.js';

export const larkImSkill: Skill = {
  name: 'lark-im',
  description: '飞书消息：发送消息、回复、查看消息记录、创建群聊',

  tools: [
    {
      type: 'function',
      function: {
        name: 'lark_im',
        description: `操作飞书消息。常用命令：
- +messages-send --chat-id <id> --text "内容"  发送消息
- +messages-reply --message-id <id> --text "内容"  回复消息
- +chat-messages-list --chat-id <id>  查看消息记录
- +chat-create --name "群名" --user-ids "id1,id2"  创建群聊
- +messages-search --query "关键词"  搜索消息
注意区分 Bot 身份和 User 身份的权限差异。`,
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '完整的 im 子命令' },
          },
          required: ['command'],
        },
      },
    },
  ],

  handlers: {
    lark_im: (args) => execLarkCli('im', args.command as string),
  },

  systemPromptSection: `### 消息通知（lark-im）
通过 lark_im 工具发送飞书消息：给群聊或个人发消息、回复消息、查看历史消息。`,
};
