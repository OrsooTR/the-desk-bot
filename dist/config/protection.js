"use strict";
/**
 * Anti-nuke.
 *
 * The threat this defends against is narrow and specific: a compromised or
 * malicious account that holds real permissions, mass-deleting channels or
 * roles, mass-banning members, or spraying webhooks. AutoMod cannot see any
 * of that — it only reads messages — so this watches the audit log instead.
 *
 * How it works: every destructive event is attributed to an executor via the
 * audit log, counted in a rolling window, and once an executor crosses a
 * threshold they are neutralised — every role removed — and the staff are
 * paged. Neutralising is preferred to banning because the usual cause is a
 * stolen session on a trusted person's account, not the person themselves.
 *
 * IMPORTANT: this cannot stop the guild owner, and it cannot stop anyone whose
 * role sits above the bot. Discord does not permit it. Keep the bot's role
 * high, and keep the number of Administrator holders at one.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTECTION = exports.THRESHOLDS = void 0;
exports.thresholdFor = thresholdFor;
/**
 * Thresholds are set above normal admin behaviour and below an attack.
 * Reorganising a category means deleting two or three channels; a nuke means
 * deleting ten in as many seconds.
 */
exports.THRESHOLDS = [
    { action: 'channelDelete', limit: 3, windowSeconds: 30, label: 'channel deletions' },
    { action: 'channelCreate', limit: 8, windowSeconds: 30, label: 'channel creations' },
    { action: 'roleDelete', limit: 3, windowSeconds: 30, label: 'role deletions' },
    { action: 'roleCreate', limit: 6, windowSeconds: 30, label: 'role creations' },
    { action: 'roleUpdate', limit: 8, windowSeconds: 30, label: 'role permission changes' },
    { action: 'ban', limit: 4, windowSeconds: 60, label: 'bans' },
    { action: 'kick', limit: 5, windowSeconds: 60, label: 'kicks' },
    { action: 'webhookCreate', limit: 3, windowSeconds: 60, label: 'webhook creations' },
];
exports.PROTECTION = {
    enabled: true,
    response: 'quarantine',
    exemptUserIds: [],
    pingStaffOnAlert: true,
    undoBans: false,
};
/** Convenience lookup used by the watcher. */
function thresholdFor(action) {
    return exports.THRESHOLDS.find((threshold) => threshold.action === action);
}
//# sourceMappingURL=protection.js.map