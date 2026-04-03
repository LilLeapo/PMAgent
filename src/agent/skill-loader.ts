import type { Skill, ToolDef, ToolHandler } from './types.js';
import { logger } from '../utils/logger.js';

/** Registry of all loaded skills */
const skills: Skill[] = [];

export function registerSkill(skill: Skill): void {
  skills.push(skill);
  logger.info('Skill registered', {
    name: skill.name,
    tools: skill.tools.map(t => t.function.name),
  });
}

/** Get all tools from all skills */
export function getAllTools(): ToolDef[] {
  return skills.flatMap(s => s.tools);
}

/** Get all handlers from all skills */
export function getAllHandlers(): Record<string, ToolHandler> {
  const handlers: Record<string, ToolHandler> = {};
  for (const skill of skills) {
    Object.assign(handlers, skill.handlers);
  }
  return handlers;
}

/** Build the combined system prompt section from all skills */
export function getSkillsPromptSection(): string {
  return skills
    .filter(s => s.systemPromptSection)
    .map(s => s.systemPromptSection)
    .join('\n\n');
}

/** List registered skills */
export function listSkills(): Array<{ name: string; description: string; tools: string[] }> {
  return skills.map(s => ({
    name: s.name,
    description: s.description,
    tools: s.tools.map(t => t.function.name),
  }));
}
