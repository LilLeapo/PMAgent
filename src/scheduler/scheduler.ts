import cron from 'node-cron';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { runStandupReminder } from './standup-reminder.job.js';
import { runRiskFollowup } from './risk-followup.job.js';
import { runStaleTaskCheck } from './stale-task-check.job.js';

export function startScheduler(): void {
  // Daily standup reminder (weekdays 10:00)
  cron.schedule(config.STANDUP_CRON, async () => {
    logger.info('Running standup reminder job');
    try {
      await runStandupReminder();
    } catch (err) {
      logger.error('Standup reminder failed', { error: err });
    }
  });

  // Weekly risk review (Monday 10:00)
  cron.schedule(config.RISK_REVIEW_CRON, async () => {
    logger.info('Running risk followup job');
    try {
      await runRiskFollowup();
    } catch (err) {
      logger.error('Risk followup failed', { error: err });
    }
  });

  // Daily stale task check (weekdays 14:00)
  cron.schedule('0 14 * * 1-5', async () => {
    logger.info('Running stale task check job');
    try {
      await runStaleTaskCheck();
    } catch (err) {
      logger.error('Stale task check failed', { error: err });
    }
  });

  logger.info('Scheduler started', {
    standup: config.STANDUP_CRON,
    riskReview: config.RISK_REVIEW_CRON,
    staleTaskCheck: '0 14 * * 1-5',
  });
}
