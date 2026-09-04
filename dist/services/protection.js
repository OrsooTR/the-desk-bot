"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noteAction = noteAction;
exports.resetProtectionState = resetProtectionState;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const protection_1 = require("../config/protection");
const server_1 = require("../config/server");
const errors_1 = require("../utils/errors");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
/** executorId → action → timestamps. In memory: a restart is a clean slate. */
const activity = new Map();
/** Executors already dealt with, so one attack produces one response. */
const handled = new Set();
const AUDIT_LOOKUP = {
    channelDelete: discord_js_1.AuditLogEvent.ChannelDelete,
    channelCreate: discord_js_1.AuditLogEvent.ChannelCreate,
    roleDelete: discord_js_1.AuditLogEvent.RoleDelete,
    roleCreate: discord_js_1.AuditLogEvent.RoleCreate,
    roleUpdate: discord_js_1.AuditLogEvent.RoleUpdate,
    ban: discord_js_1.AuditLogEvent.MemberBanAdd,
    kick: discord_js_1.AuditLogEvent.MemberKick,
    webhookCreate: discord_js_1.AuditLogEvent.WebhookCreate,
};
/**
 * Record one destructive action and respond if it crosses a threshold.
 * Called from the gateway event handlers.
 */
async function noteAction(guild, action) {
    if (!protection_1.PROTECTION.enabled)
        return;
    const executorId = await resolveExecutor(guild, action);
    if (!executorId)
        return;
    if (isExempt(guild, executorId))
        return;
    const threshold = (0, protection_1.thresholdFor)(action);
    if (!threshold)
        return;
    const perUser = activity.get(executorId) ?? new Map();
    const cutoff = Date.now() - threshold.windowSeconds * 1000;
    const recent = [...(perUser.get(action) ?? []), { at: Date.now() }].filter((record) => record.at >= cutoff);
    perUser.set(action, recent);
    activity.set(executorId, perUser);
    if (recent.length < threshold.limit)
        return;
    if (handled.has(executorId))
        return;
    handled.add(executorId);
    await respond(guild, executorId, threshold.label, recent.length, threshold.windowSeconds);
}
/**
 * Who did it? The gateway does not say, so the audit log is consulted.
 * Only entries from the last few seconds are trusted — an older entry would
 * attribute this action to whoever last did something similar.
 */
async function resolveExecutor(guild, action) {
    const me = guild.members.me;
    if (!me?.permissions.has(discord_js_1.PermissionFlagsBits.ViewAuditLog)) {
        logger_1.logger.warn('PERMISSIONS', 'Anti-nuke is blind: I need the View Audit Log permission to see who performed an action.', { discord: false });
        return null;
    }
    try {
        const logs = await guild.fetchAuditLogs({ type: AUDIT_LOOKUP[action], limit: 1 });
        const entry = logs.entries.first();
        if (!entry?.executor)
            return null;
        if (Date.now() - entry.createdTimestamp > 10_000)
            return null;
        if (entry.executor.id === guild.client.user?.id)
            return null;
        return entry.executor.id;
    }
    catch (error) {
        logger_1.logger.error('ERROR', 'Could not read the audit log for anti-nuke', error);
        return null;
    }
}
function isExempt(guild, userId) {
    if (userId === guild.ownerId)
        return true;
    if (userId === guild.client.user?.id)
        return true;
    return protection_1.PROTECTION.exemptUserIds.includes(userId);
}
/** Strip the executor's roles (or ban them) and page the staff. */
async function respond(guild, executorId, label, count, windowSeconds) {
    const member = await guild.members.fetch(executorId).catch(() => null);
    const summary = `${count} ${label} in ${windowSeconds}s`;
    logger_1.logger.error('MODERATION', `ANTI-NUKE TRIGGERED — ${member?.user.tag ?? executorId}: ${summary}`);
    let applied = 'no action taken';
    let problem;
    try {
        if (!member) {
            problem = 'The executor is no longer in the server.';
        }
        else if (protection_1.PROTECTION.response === 'ban') {
            await member.ban({ reason: `Anti-nuke: ${summary}` });
            applied = 'banned';
        }
        else {
            // Quarantine rather than ban: the usual cause is a stolen session on a
            // trusted account, and a ban makes recovery harder than it needs to be.
            const removable = member.roles.cache.filter((role) => role.id !== guild.id && !role.managed);
            await member.roles.remove(removable, `Anti-nuke: ${summary}`);
            applied = `quarantined — ${removable.size} role(s) removed`;
        }
    }
    catch (error) {
        problem =
            'I could not act on them. They are almost certainly above me in the role list, or they are the server owner.';
        logger_1.logger.error('MODERATION', `Anti-nuke response failed for ${executorId}`, error);
        console.error((0, errors_1.describeError)(error));
    }
    await alert(guild, executorId, summary, applied, problem);
}
async function alert(guild, executorId, summary, applied, problem) {
    const channel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.moderationChannelKey);
    if (!channel)
        return;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.danger)
        .setTitle('ANTI-NUKE TRIGGERED')
        .setDescription(`<@${executorId}> exceeded a destructive-action threshold and was stopped automatically.`)
        .addFields({ name: 'Detected', value: summary, inline: true }, { name: 'Response', value: applied, inline: true }, { name: 'User ID', value: `\`${executorId}\``, inline: true })
        .setFooter({ text: `${branding_1.BRAND.footer} · verify this before restoring anything` })
        .setTimestamp(new Date());
    if (problem)
        embed.addFields({ name: 'Could not complete', value: problem });
    embed.addFields({
        name: 'What to do now',
        value: [
            '1. Confirm whether this was an attack or legitimate admin work.',
            '2. If it was an attack, assume the account is compromised — do not restore its roles.',
            '3. Deleted channels cannot be recovered. Run `/setup` to rebuild the structure.',
            '4. Check the audit log for anything this missed.',
        ].join('\n'),
    });
    const admin = protection_1.PROTECTION.pingStaffOnAlert ? (0, resolve_1.findRole)(guild, 'admin') : null;
    await channel
        .send({
        ...(admin ? { content: `<@&${admin.id}>` } : {}),
        embeds: [embed],
        allowedMentions: admin ? { roles: [admin.id] } : { parse: [] },
    })
        .catch(() => logger_1.logger.warn('MODERATION', 'Could not post the anti-nuke alert.'));
}
/** Clears the in-memory counters. Exposed for tests and manual recovery. */
function resetProtectionState() {
    activity.clear();
    handled.clear();
}
//# sourceMappingURL=protection.js.map