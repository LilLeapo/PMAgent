import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

/** Resolve lark-cli binary: prefer local node_modules/.bin, fallback to global */
function findLarkCli(): string {
  // Walk up from this file to find project root's node_modules/.bin
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const localBin = resolve(__dirname, '..', '..', 'node_modules', '.bin', 'lark-cli');
  if (existsSync(localBin) || existsSync(localBin + '.cmd')) {
    return localBin;
  }
  // Fallback to PATH
  return 'lark-cli';
}

const LARK_CLI = findLarkCli();

/**
 * Execute a lark-cli command safely.
 * @param service - The lark-cli service (base, task, im, doc, etc.)
 * @param command - The sub-command and flags
 */
export async function execLarkCli(service: string, command: string): Promise<string> {
  // Security: block shell injection
  if (/[;&|`$]/.test(command)) {
    return JSON.stringify({ error: '命令包含不安全字符，已拒绝执行' });
  }

  const fullCommand = `"${LARK_CLI}" ${service} ${command}`;
  logger.info('lark-cli exec', { command: fullCommand });

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });

    const output = stdout || stderr;
    if (output.length > 4000) {
      return output.slice(0, 4000) + '\n...(输出已截断)';
    }
    return output || '(无输出)';
  } catch (err: any) {
    const errorOutput = err.stderr || err.stdout || err.message;
    logger.error('lark-cli error', { command: fullCommand, error: errorOutput?.slice(0, 500) });

    if (err.message?.includes('not found') || err.message?.includes('ENOENT')) {
      return JSON.stringify({
        error: 'lark-cli 未安装。请运行: npm install && lark-cli config init',
      });
    }

    return JSON.stringify({ error: errorOutput?.slice(0, 2000) || String(err) });
  }
}
