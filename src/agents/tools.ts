import type { ToolDefinition, ToolCall } from './base-agent.js';
import type { ToolHandler } from './agent-loop.js';
import { decomposeRequirement } from './task-decomposer.js';
import * as cycleManager from './cycle-manager.js';
import * as riskAnalyzer from './risk-analyzer.js';
import * as bitable from '../services/bitable.service.js';
import { fetchDocFromUrl } from '../services/document.service.js';
import { tableIds } from '../repositories/table-ids.js';
import { config } from '../config.js';

export const PM_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'decompose_requirement',
      description: '将用户的需求拆解为可执行的工程任务。当用户描述一个新功能、新需求、或发送PRD文档链接时使用。',
      parameters: {
        type: 'object',
        properties: {
          requirement: {
            type: 'string',
            description: '需求描述的完整内容',
          },
          doc_urls: {
            type: 'array',
            items: { type: 'string' },
            description: '飞书文档链接列表（如有）',
          },
        },
        required: ['requirement'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cycle_status',
      description: '查询当前活跃迭代/Sprint的进度状态',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_cycle',
      description: '创建新的迭代/Sprint',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '迭代名称，如 Sprint 15' },
          start_date: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          end_date: { type: 'string', description: '结束日期 YYYY-MM-DD' },
          goal: { type: 'string', description: '迭代目标' },
        },
        required: ['name', 'start_date', 'end_date', 'goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_cycle',
      description: '关闭当前活跃的迭代，生成回顾总结，未完成任务移回Backlog',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_risk',
      description: '记录一个项目风险',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '风险标题' },
          description: { type: 'string', description: '风险详细描述' },
          probability: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          impact: { type: 'string', enum: ['Critical', 'Major', 'Minor'] },
        },
        required: ['title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_risk_report',
      description: '查看当前所有未解决风险的报告',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_feishu_doc',
      description: '获取飞书文档内容，用于分析PRD或需求文档',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '飞书文档链接' },
        },
        required: ['url'],
      },
    },
  },
];

export const PM_TOOL_HANDLERS: Record<string, ToolHandler> = {
  async decompose_requirement(args) {
    const requirement = args.requirement as string;
    const docUrls = (args.doc_urls as string[]) || [];

    if (!config.BITABLE_APP_TOKEN) {
      const result = await decomposeRequirement(requirement, docUrls);
      return JSON.stringify(result, null, 2);
    }

    const result = await decomposeRequirement(requirement, docUrls);

    // Write to bitable
    try {
      for (const task of result.tasks) {
        await bitable.createRecord(tableIds.tasks, {
          '标题': task.title,
          '描述': task.description,
          '状态': 'Backlog',
          '优先级': task.priority,
          '预估工时': task.estimated_effort,
          '标签': task.tags,
          '来源需求': result.requirement_summary,
        });
      }
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
    } catch (err) {
      // Bitable not configured, just return the result
    }

    return JSON.stringify(result, null, 2);
  },

  async get_cycle_status() {
    const activeCycle = await cycleManager.getActiveCycle();
    if (!activeCycle) return '当前没有进行中的迭代。';
    const summary = await cycleManager.getCycleStatus(activeCycle.record_id);
    return summary;
  },

  async create_cycle(args) {
    const recordId = await cycleManager.createCycle({
      name: args.name as string,
      status: 'Active',
      start_date: args.start_date as string,
      end_date: args.end_date as string,
      goal: args.goal as string,
    });
    return `迭代「${args.name}」已创建，记录ID: ${recordId}`;
  },

  async close_cycle() {
    const activeCycle = await cycleManager.getActiveCycle();
    if (!activeCycle) return '当前没有进行中的迭代。';
    const { summary, movedTasks } = await cycleManager.closeCycle(activeCycle.record_id);
    return `迭代已关闭。${movedTasks}个未完成任务移回Backlog。\n\n回顾：${summary}`;
  },

  async add_risk(args) {
    const recordId = await riskAnalyzer.addRisk({
      title: args.title as string,
      description: args.description as string,
      probability: (args.probability as any) || 'Medium',
      impact: (args.impact as any) || 'Major',
      status: 'Open',
      mitigation_plan: '',
    });
    return `风险「${args.title}」已记录，ID: ${recordId}`;
  },

  async get_risk_report() {
    return await riskAnalyzer.generateRiskReport();
  },

  async fetch_feishu_doc(args) {
    const content = await fetchDocFromUrl(args.url as string);
    return content || '无法获取文档内容';
  },
};
