"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
exports.stopScheduler = stopScheduler;
const env_1 = require("../config/env");
const news_1 = require("../config/news");
const logger_1 = require("./logger");
const news_2 = require("./news");
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
let timer = null;
function startScheduler(client) {
    if (!news_1.NEWS.enabled) {
        logger_1.logger.info('BOOT', 'Daily digest is disabled in config/news.ts', { discord: false });
        return;
    }
    scheduleNext(client);
}
function stopScheduler() {
    if (timer)
        clearTimeout(timer);
    timer = null;
}
function scheduleNext(client) {
    const delay = msUntilNextRun();
    const at = new Date(Date.now() + delay);
    logger_1.logger.info('BOOT', `Next market digest: ${at.toISOString()} (in ${Math.round(delay / 60000)} min)`, { discord: false });
    timer = setTimeout(() => {
        void run(client).finally(() => scheduleNext(client));
    }, delay);
    // Never hold the process open purely for a timer.
    timer.unref?.();
}
async function run(client) {
    try {
        const guild = await client.guilds.fetch((0, env_1.env)().guildId);
        await (0, news_2.postDigest)(await guild.fetch());
    }
    catch (error) {
        // A failed digest must never stop tomorrow's from being scheduled.
        logger_1.logger.error('EVENT', 'The scheduled market digest failed', error);
    }
}
function msUntilNextRun() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), news_1.NEWS.postAtUtc.hour, news_1.NEWS.postAtUtc.minute, 0, 0));
    if (next.getTime() <= now.getTime())
        next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
}
//# sourceMappingURL=scheduler.js.map