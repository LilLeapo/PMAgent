import type { ParsedMessage } from '../gateway/message-parser.js';
import { detectIntent } from './intent-detector.js';
import { callLLMText } from '../agents/base-agent.js';
import { decomposeRequirement } from '../agents/task-decomposer.js';
import * as cycleManager from '../agents/cycle-manager.js';
import * as riskAnalyzer from '../agents/risk-analyzer.js';
import * as bitable from '../services/bitable.service.js';
import * as messaging from '../services/messaging.service.js';
import { tableIds } from '../repositories/table-ids.js';
import { buildTaskListCard } from '../cards/task-list.card.js';
import { buildCycleStatusCard } from '../cards/cycle-status.card.js';
import { buildRiskReportCard } from '../cards/risk-report.card.js';
import { logger } from '../utils/logger.js';

export async function handleMessage(msg: ParsedMessage): Promise<void> {
  const { text, chatId, messageId, senderId, feishuDocUrls } = msg;

  try {
    // Detect intent
    const intent = await detectIntent(text, feishuDocUrls);
    logger.info('Intent detected', { intent: intent.intent, confidence: intent.confidence });

    switch (intent.intent) {
      case 'decompose_task':
        await handleDecomposeTask(msg, intent.entities.raw_requirement || text);
        break;

      case 'cycle_create':
        await handleCycleCreate(msg, intent.entities.cycle_name);
        break;

      case 'cycle_status':
        await handleCycleStatus(msg);
        break;

      case 'cycle_close':
        await handleCycleClose(msg);
        break;

      case 'risk_add':
        await handleRiskAdd(msg, intent.entities.risk_description || text);
        break;

      case 'risk_report':
        await handleRiskReport(msg);
        break;

      case 'task_update':
        await handleTaskUpdate(msg, intent.entities.task_ids, intent.entities.status);
        break;

      case 'help':
        await handleHelp(msg);
        break;

      default:
        await handleChat(msg);
    }
  } catch (err) {
    logger.error('Error handling message', { error: err, text });
    await messaging.replyText(messageId, '处理消息时出错了，请稍后重试。');
  }
}

async function handleDecomposeTask(msg: ParsedMessage, rawInput: string): Promise<void> {
  await messaging.replyText(msg.messageId, '正在分析需求，请稍候...');

  // Save requirement
  const reqRecord = await bitable.createRecord(tableIds.requirements, {
    '标题': rawInput.slice(0, 50),
    '原始输入': rawInput,
    '来源类型': msg.feishuDocUrls.length > 0 ? 'Feishu Doc' : 'Chat Message',
    ...(msg.feishuDocUrls.length > 0 ? { '来源链接': msg.feishuDocUrls[0] } : {}),
    '状态': 'New',
    '提交人': [{ id: msg.senderId }],
  });

  // Decompose
  const result = await decomposeRequirement(rawInput, msg.feishuDocUrls);

  // Update requirement status
  await bitable.updateRecord(tableIds.requirements, reqRecord.record_id, {
    '状态': 'Analyzed',
    '标题': result.requirement_summary,
  });

  // Send card with results (tasks not yet written to bitable - user confirms first)
  // Store decomposition result temporarily for confirmation
  pendingDecompositions.set(reqRecord.record_id, result);

  const card = buildTaskListCard(result, reqRecord.record_id);
  await messaging.replyCard(msg.messageId, card);
}

// In-memory store for pending task confirmations
const pendingDecompositions = new Map<string, ReturnType<typeof decomposeRequirement> extends Promise<infer T> ? T : never>();

export async function confirmTaskCreation(requirementId: string): Promise<number> {
  const result = pendingDecompositions.get(requirementId);
  if (!result) throw new Error('No pending decomposition found');

  // Create tasks in bitable
  const taskRecords = await bitable.batchCreateRecords(
    tableIds.tasks,
    result.tasks.map(task => ({
      fields: {
        '标题': task.title,
        '描述': task.description,
        '状态': 'Backlog',
        '优先级': task.priority,
        '预估工时': task.estimated_effort,
        '标签': task.tags,
        '来源需求': result.requirement_summary,
      },
    })),
  );

  // Create risks in bitable
  for (const risk of result.risks) {
    await riskAnalyzer.addRisk({
      title: risk.title,
      description: risk.description,
      probability: risk.probability,
      impact: risk.impact,
      status: 'Open',
      mitigation_plan: risk.mitigation,
    });
  }

  // Update requirement status
  await bitable.updateRecord(tableIds.requirements, requirementId, { '状态': 'Decomposed' });

  pendingDecompositions.delete(requirementId);
  return taskRecords.length;
}

async function handleCycleCreate(msg: ParsedMessage, cycleName: string): Promise<void> {
  if (!cycleName) {
    await messaging.replyText(msg.messageId, '请指定迭代名称，例如："创建迭代 Sprint 15 从4月7日到4月18日"');
    return;
  }

  // Simple date parsing - for MVP, ask user to provide dates
  await messaging.replyText(
    msg.messageId,
    `正在创建迭代「${cycleName}」，请补充信息：\n1. 开始日期（如 2026-04-07）\n2. 结束日期（如 2026-04-18）\n3. 迭代目标`,
  );
}

async function handleCycleStatus(msg: ParsedMessage): Promise<void> {
  const activeCycle = await cycleManager.getActiveCycle();
  if (!activeCycle) {
    await messaging.replyText(msg.messageId, '当前没有进行中的迭代。');
    return;
  }

  await messaging.replyText(msg.messageId, '正在生成进度报告...');

  const summary = await cycleManager.getCycleStatus(activeCycle.record_id);

  // Calculate stats
  const tasks = await bitable.searchRecords(tableIds.tasks, {
    conjunction: 'and',
    conditions: [{ field_name: '迭代', operator: 'contains', value: [activeCycle.record_id] }],
  });

  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.fields['状态'] === 'Done').length,
    inProgress: tasks.filter(t => t.fields['状态'] === 'In Progress').length,
    blocked: tasks.filter(t => t.fields['状态'] === 'Blocked').length,
    totalEffort: tasks.reduce((s, t) => s + ((t.fields['预估工时'] as number) || 0), 0),
    doneEffort: tasks
      .filter(t => t.fields['状态'] === 'Done')
      .reduce((s, t) => s + ((t.fields['预估工时'] as number) || 0), 0),
    daysLeft: Math.ceil(
      ((activeCycle.fields['结束日期'] as number) - Date.now()) / (24 * 60 * 60 * 1000),
    ),
  };

  const card = buildCycleStatusCard(activeCycle.fields['名称'] as string, summary, stats);
  await messaging.replyCard(msg.messageId, card);
}

async function handleCycleClose(msg: ParsedMessage): Promise<void> {
  const activeCycle = await cycleManager.getActiveCycle();
  if (!activeCycle) {
    await messaging.replyText(msg.messageId, '当前没有进行中的迭代。');
    return;
  }

  await messaging.replyText(msg.messageId, '正在关闭迭代，生成回顾总结...');
  const { summary, movedTasks } = await cycleManager.closeCycle(activeCycle.record_id);

  await messaging.sendText(
    msg.chatId,
    `✅ 迭代「${activeCycle.fields['名称']}」已关闭。\n${movedTasks > 0 ? `${movedTasks}个未完成任务已移回Backlog。` : ''}\n\n📝 回顾总结：\n${summary}`,
  );
}

async function handleRiskAdd(msg: ParsedMessage, description: string): Promise<void> {
  await riskAnalyzer.addRisk({
    title: description.slice(0, 50),
    description,
    probability: 'Medium',
    impact: 'Major',
    status: 'Open',
    mitigation_plan: '',
    identified_by: msg.senderId,
  });
  await messaging.replyText(msg.messageId, `⚠️ 风险已记录。请在多维表格中补充概率、影响和缓解方案。`);
}

async function handleRiskReport(msg: ParsedMessage): Promise<void> {
  await messaging.replyText(msg.messageId, '正在生成风险报告...');

  const openRisks = await riskAnalyzer.getOpenRisks();
  const report = await riskAnalyzer.generateRiskReport();
  const card = buildRiskReportCard(report, openRisks.length);
  await messaging.replyCard(msg.messageId, card);
}

async function handleTaskUpdate(msg: ParsedMessage, taskIds: string[], status: string): Promise<void> {
  if (taskIds.length === 0) {
    await messaging.replyText(msg.messageId, '请指定任务编号，例如："完成 T-001"');
    return;
  }
  // For MVP: update by searching task title prefix
  await messaging.replyText(msg.messageId, `更新任务状态功能开发中，请在多维表格中直接修改。`);
}

async function handleHelp(msg: ParsedMessage): Promise<void> {
  await messaging.replyText(msg.messageId, [
    '🤖 我是PM Agent，可以帮你：',
    '',
    '📋 **任务管理**',
    '• 发送需求描述或PRD链接 → 自动拆解任务',
    '• "Sprint进度" → 查看当前迭代状态',
    '',
    '🔄 **迭代管理**',
    '• "创建迭代 Sprint 15" → 新建迭代',
    '• "关闭迭代" → 关闭当前迭代并生成回顾',
    '',
    '⚠️ **风险管理**',
    '• "风险: xxx" → 记录一个风险',
    '• "风险报告" → 查看风险概览',
    '',
    '💡 直接在群里@我说话就行！',
  ].join('\n'));
}

async function handleChat(msg: ParsedMessage): Promise<void> {
  const reply = await callLLMText({
    system: `你是一个友好的AI项目管理助手（PM Agent），部署在飞书群里。你的核心能力是：任务拆解、迭代管理、风险管理。

当用户和你闲聊时，你可以正常对话，但适当引导他们使用你的PM功能。
回复简洁，不超过200字。用中文回复。`,
    user: msg.text,
    maxTokens: 512,
  });
  await messaging.replyText(msg.messageId, reply);
}
