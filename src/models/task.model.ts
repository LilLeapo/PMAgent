import { z } from 'zod';

export const TaskStatus = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done', 'Blocked'] as const;
export const TaskPriority = ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'] as const;
export const TaskTag = ['frontend', 'backend', 'design', 'infra', 'testing'] as const;

export interface Task {
  record_id?: string;
  title: string;
  description: string;
  status: (typeof TaskStatus)[number];
  priority: (typeof TaskPriority)[number];
  assignee?: string; // open_id
  cycle_record_id?: string;
  parent_task_id?: string;
  source_requirement: string;
  estimated_effort: number;
  due_date?: string;
  tags: string[];
  created_by?: string;
}

export const DecompositionResultSchema = z.object({
  requirement_summary: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(TaskPriority),
    estimated_effort: z.number(),
    tags: z.array(z.string()),
    suggested_role: z.string(),
    dependencies: z.array(z.string()).default([]),
  })),
  risks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    probability: z.enum(['High', 'Medium', 'Low']),
    impact: z.enum(['Critical', 'Major', 'Minor']),
    mitigation: z.string(),
  })),
  total_estimated_effort: z.number(),
  suggested_timeline: z.string(),
});

export type DecompositionResult = z.infer<typeof DecompositionResultSchema>;
