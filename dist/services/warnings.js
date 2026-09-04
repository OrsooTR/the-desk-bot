"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeStrikes = activeStrikes;
exports.activePoints = activePoints;
exports.allStrikes = allStrikes;
exports.clearStrikes = clearStrikes;
exports.fileStrike = fileStrike;
const moderation_1 = require("../config/moderation");
const errors_1 = require("../utils/errors");
const logger_1 = require("./logger");
const moderationLog_1 = require("./moderationLog");
const state_1 = require("./state");
function decayCutoff() {
    return Date.now() - moderation_1.STRIKE_DECAY_DAYS * 24 * 60 * 60 * 1000;
}
/** Strikes still inside the decay window, newest first. */
function activeStrikes(userId) {
    const cutoff = decayCutoff();
    return (state_1.state.read().strikes[userId] ?? [])
        .filter((strike) => Date.parse(strike.at) >= cutoff)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
function activePoints(userId) {
    return activeStrikes(userId).reduce((total, strike) => total + strike.points, 0);
}
/** Every strike ever filed, including expired ones. Used by /warnings. */
function allStrikes(userId) {
    return [...(state_1.state.read().strikes[userId] ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
function clearStrikes(userId) {
    const existing = state_1.state.read().strikes[userId]?.length ?? 0;
    state_1.state.update((current) => {
        delete current.strikes[userId];
    });
    return existing;
}
/**
 * File a strike and carry out whatever the ladder says.
 *
 * The record is written before the consequence is attempted: if the timeout
 * fails because the member outranks the bot, the strike must still stand.
 */
async function fileStrike(guild, target, moderator, offenceKey, reason, automatic = false) {
    const offence = (0, moderation_1.findOffence)(offenceKey);
    if (!offence)
        throw new errors_1.OperationalError(`Unknown offence type: ${offenceKey}`);
    const record = {
        offenceKey: offence.key,
        points: offence.points,
        reason,
        moderatorId: moderator.id,
        at: new Date().toISOString(),
        ...(automatic ? { automatic: true } : {}),
    };
    state_1.state.update((current) => {
        current.strikes[target.id] = [...(current.strikes[target.id] ?? []), record];
    });
    const points = activePoints(target.id);
    const step = offence.immediate ? null : (0, moderation_1.resolveLadder)(points);
    const outcome = {
        offence,
        activePoints: points,
        step,
        applied: 'Warning recorded',
    };
    await notify(target, guild.name, offence, reason, points);
    try {
        if (offence.immediate === 'ban') {
            await guild.members.ban(target.id, {
                reason: `${offence.label}: ${reason} — filed by ${moderator.tag}`,
            });
            outcome.applied = 'Banned immediately';
        }
        else if (offence.immediate === 'kick') {
            await target.kick(`${offence.label}: ${reason} — filed by ${moderator.tag}`);
            outcome.applied = 'Removed from the server';
        }
        else if (step?.action.type === 'ban') {
            await guild.members.ban(target.id, { reason: `Strike ladder: ${reason}` });
            outcome.applied = step.summary;
        }
        else if (step?.action.type === 'kick') {
            await target.kick(`Strike ladder: ${reason}`);
            outcome.applied = step.summary;
        }
        else if (step?.action.type === 'timeout') {
            await target.timeout(step.action.minutes * 60_000, `Strike ladder: ${reason}`);
            outcome.applied = step.summary;
        }
        else if (step) {
            outcome.applied = step.summary;
        }
    }
    catch (error) {
        outcome.problem =
            'The strike was recorded, but I could not carry out the consequence — the member is probably above me in the role list.';
        logger_1.logger.error('MODERATION', `Could not apply the ladder to ${target.user.tag}`, error);
    }
    await (0, moderationLog_1.recordModeration)(guild, {
        action: 'WARN',
        moderator,
        target: target.user,
        reason: `${offence.label} — ${reason}`,
        detail: `${offence.points} pt · total ${points} · ${outcome.applied}${automatic ? ' · automatic' : ''}`,
    });
    return outcome;
}
/** Tell the member what happened. A silent punishment teaches nothing. */
async function notify(target, guildName, offence, reason, points) {
    const lines = [
        `You have received a warning in **${guildName}**.`,
        '',
        `**Offence:** ${offence.label}`,
        `**Reason:** ${reason}`,
        `**Points:** ${offence.points} (active total: ${points})`,
        '',
        offence.immediate
            ? 'This category does not carry a warning ladder.'
            : `Points expire after ${moderation_1.STRIKE_DECAY_DAYS} days. At 2 points you are timed out for an hour, at 7 you are banned.`,
        '',
        'If you believe this is wrong, open a ticket rather than arguing in the channel.',
    ];
    // A member with DMs closed must not block moderation.
    await target.send(lines.join('\n')).catch(() => undefined);
}
//# sourceMappingURL=warnings.js.map