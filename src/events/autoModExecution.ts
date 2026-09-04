import { EmbedBuilder, type AutoModerationActionExecution } from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import { SERVER } from '../config/server';
import { logger } from '../services/logger';
import { findTextChannel } from '../services/resolve';
import { escapeMarkdown, truncate } from '../utils/format';

/**
 * Records every AutoMod block in #moderation.
 *
 * Discord's own alert message is terse and easy to miss. This gives the staff
 * a consistent case record in the same place as every other moderation event,
 * so a pattern across several blocked messages is actually visible.
 */
export async function onAutoModerationActionExecution(
  execution: AutoModerationActionExecution,
): Promise<void> {
  const guild = execution.guild;
  logger.info(
    'MODERATION',
    `AUTOMOD blocked a message from ${execution.userId} (rule: ${execution.ruleTriggerType})`,
  );

  const channel = findTextChannel(guild, SERVER.moderationChannelKey);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle('AUTOMOD')
    .addFields(
      { name: 'Member', value: `<@${execution.userId}>`, inline: true },
      {
        name: 'Channel',
        value: execution.channelId ? `<#${execution.channelId}>` : 'unknown',
        inline: true,
      },
      { name: 'Matched', value: `\`${escapeMarkdown(execution.matchedKeyword ?? 'preset')}\``, inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · blocked before delivery` })
    .setTimestamp(new Date());

  if (execution.content) {
    // Quoted in a code block so the blocked content cannot ping anyone or
    // render markdown inside the case record.
    embed.addFields({
      name: 'Content',
      value: `\`\`\`\n${truncate(execution.content.replace(/`/g, "'"), 900)}\n\`\`\``,
    });
  }

  await channel
    .send({ embeds: [embed], allowedMentions: { parse: [] } })
    .catch(() => logger.warn('MODERATION', 'Could not record the AutoMod alert.'));
}
