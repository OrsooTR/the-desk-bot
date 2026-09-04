"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAutoModerationActionExecution = onAutoModerationActionExecution;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const server_1 = require("../config/server");
const logger_1 = require("../services/logger");
const resolve_1 = require("../services/resolve");
const format_1 = require("../utils/format");
/**
 * Records every AutoMod block in #moderation.
 *
 * Discord's own alert message is terse and easy to miss. This gives the staff
 * a consistent case record in the same place as every other moderation event,
 * so a pattern across several blocked messages is actually visible.
 */
async function onAutoModerationActionExecution(execution) {
    const guild = execution.guild;
    logger_1.logger.info('MODERATION', `AUTOMOD blocked a message from ${execution.userId} (rule: ${execution.ruleTriggerType})`);
    const channel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.moderationChannelKey);
    if (!channel)
        return;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.warning)
        .setTitle('AUTOMOD')
        .addFields({ name: 'Member', value: `<@${execution.userId}>`, inline: true }, {
        name: 'Channel',
        value: execution.channelId ? `<#${execution.channelId}>` : 'unknown',
        inline: true,
    }, { name: 'Matched', value: `\`${(0, format_1.escapeMarkdown)(execution.matchedKeyword ?? 'preset')}\``, inline: true })
        .setFooter({ text: `${branding_1.BRAND.footer} · blocked before delivery` })
        .setTimestamp(new Date());
    if (execution.content) {
        // Quoted in a code block so the blocked content cannot ping anyone or
        // render markdown inside the case record.
        embed.addFields({
            name: 'Content',
            value: `\`\`\`\n${(0, format_1.truncate)(execution.content.replace(/`/g, "'"), 900)}\n\`\`\``,
        });
    }
    await channel
        .send({ embeds: [embed], allowedMentions: { parse: [] } })
        .catch(() => logger_1.logger.warn('MODERATION', 'Could not record the AutoMod alert.'));
}
//# sourceMappingURL=autoModExecution.js.map