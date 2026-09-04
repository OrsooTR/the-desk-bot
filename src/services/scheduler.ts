import type { Client } from 'discord.js';
import { env } from '../config/env';
import { NEWS } from '../config/news';
import { logger } from './logger';
import { postDigest } from './news';

/* ────────────────────────────────────────────────────────────
 * The daily scheduler
 *
 * One job today: post the market digest at a fixed UTC time.
 *
 * Implemented with a chained setTimeout rather than an interval, because an
 * interval drifts and, more importantly, silently double-fires around a clock
 * change. Each run computes the next occurrence from scratch, so the schedule
 * is correct after a restart, after a DST transition, and after the process
 * has been asleep.
 *
 * This obviously only fires while the bot is running. A digest missed
 * overnight is not backfilled — a stale digest is worse than none — but
 * `/news` posts one on demand.
 * ──────────────────────────────────────────────────────────── */

let timer: NodeJS.Timeout | null = null;

export function startScheduler(client: Client): void {
  if (!NEWS.enabled) {
    logger.info('BOOT', 'Daily digest is disabled in config/news.ts', { discord: false });
    return;
  }

  scheduleNext(client);
}

export function stopScheduler(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

function scheduleNext(client: Client): void {
  const delay = msUntilNextRun();
  const at = new Date(Date.now() + delay);

  logger.info(
    'BOOT',
    `Next market digest: ${at.toISOString()} (in ${Math.round(delay / 60000)} min)`,
    { discord: false },
  );

  timer = setTimeout(() => {
    void run(client).finally(() => scheduleNext(client));
  }, delay);

  // Never hold the process open purely for a timer.
  timer.unref?.();
}

async function run(client: Client): Promise<void> {
  try {
    const guild = await client.guilds.fetch(env().guildId);
    await postDigest(await guild.fetch());
  } catch (error) {
    // A failed digest must never stop tomorrow's from being scheduled.
    logger.error('EVENT', 'The scheduled market digest failed', error);
  }
}

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      NEWS.postAtUtc.hour,
      NEWS.postAtUtc.minute,
      0,
      0,
    ),
  );

  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}
