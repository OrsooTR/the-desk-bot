"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordModeration = recordModeration;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
/**
 * Writes a moderation case to #moderation and the bot log.
 *
 * Two destinations on purpose: #moderation is the human-readable case history
 * staff actually read, #bot-logs is the machine-shaped stream. Failing to
 * write either must never undo an action that has already been taken, so this
 * function does not throw.
 */
async function recordModeration(guild, record) {
    const summary = [
        record.target ? `${record.target.tag} (${record.target.id})` : null,
        record.detail,
    ]
        .filter(Boolean)
        .join(' — ');
    logger_1.logger.info('MODERATION', `${record.action}: ${summary || 'n/a'} by ${record.moderator.tag}${record.reason ? ` — ${record.reason}` : ''}`);
    const channel = (0, resolve_1.findTextChannel)(guild, 'moderation');
    if (!channel)
        return;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(record.action === 'BAN' ? branding_1.COLORS.danger : branding_1.COLORS.warning)
        .setTitle(record.action)
        .setFooter({ text: branding_1.BRAND.footer })
        .setTimestamp(new Date())
        .addFields({ name: 'Moderator', value: `<@${record.moderator.id}>`, inline: true });
    if (record.target) {
        embed.addFields({
            name: 'Member',
            value: `<@${record.target.id}>\n\`${(0, format_1.escapeMarkdown)(record.target.tag)}\``,
            inline: true,
        });
    }
    if (record.detail)
        embed.addFields({ name: 'Detail', value: record.detail, inline: true });
    embed.addFields({
        name: 'Reason',
        value: (0, format_1.truncate)(record.reason?.trim() || 'No reason given.', 1024),
    });
    await channel.send({ embeds: [embed] }).catch(() => {
        logger_1.logger.warn('MODERATION', 'Could not write the case to #moderation — the action itself succeeded.');
    });
}
//# sourceMappingURL=moderationLog.js.map