import { config } from './config.js';
import { FeishuChannel } from './channel/feishu.js';
import { runLoop } from './agent/loop.js';
import { registerSkill, getAllTools, getAllHandlers, getSkillsPromptSection } from './agent/skill-loader.js';
import { larkBaseSkill } from './skills/lark-base/index.js';
import { larkTaskSkill } from './skills/lark-task/index.js';
import { larkImSkill } from './skills/lark-im/index.js';
import { larkDocSkill } from './skills/lark-doc/index.js';
import { pmToolsSkill } from './tools/pm-tools.js';
import { startScheduler } from './scheduler/scheduler.js';
import { logger } from './utils/logger.js';

const BASE_SYSTEM_PROMPT = `你是一个部署在飞书里的AI项目管理助手，叫PMBot。

你的核心职责：
1. 帮团队拆解需求为可执行的任务
2. 管理迭代周期（Sprint）
3. 识别和跟踪项目风险
4. 通过飞书平台分配任务、发送通知、管理文档

你可以用工具直接操作飞书平台。当用户只是闲聊或问问题时，直接回复即可，不需要调用工具。

回复规则：
- 用中文，简洁友好，像一个靠谱的同事
- 调用工具后用自然语言总结结果，不要返回原始JSON
- 写操作前如果有不确定的，先和用户确认`;

async function main() {
  logger.info('Starting PM Agent...', { botName: config.BOT_NAME });

  // 1. Register skills
  registerSkill(pmToolsSkill);
  registerSkill(larkBaseSkill);
  registerSkill(larkTaskSkill);
  registerSkill(larkImSkill);
  registerSkill(larkDocSkill);

  // 2. Build agent config
  const tools = getAllTools();
  const handlers = getAllHandlers();
  const skillsPrompt = getSkillsPromptSection();
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${skillsPrompt}`;

  logger.info('Skills loaded', { toolCount: tools.length });

  // 3. Start Feishu channel
  const channel = new FeishuChannel();

  channel.onMessage(async (msg) => {
    try {
      const reply = await runLoop(msg, {
        systemPrompt,
        tools,
        handlers,
        maxIterations: 8,
      });

      await channel.reply(msg.id, reply);
    } catch (err) {
      logger.error('Message handling failed', { error: err, text: msg.text });
      await channel.reply(msg.id, '处理消息时出错了，请稍后重试。').catch(() => {});
    }
  });

  await channel.start();

  // 4. Start scheduler
  startScheduler();

  logger.info('PM Agent is running!');

  // Keep alive
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

main().catch(err => {
  logger.error('Fatal', { error: err });
  process.exit(1);
});
