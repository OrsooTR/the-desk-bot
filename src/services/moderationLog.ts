import { EmbedBuilder, type Guild, type User } from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import { escapeMarkdown, truncate } from '../utils/format';
import { logger } from './logger';
import { findTextChannel } from './resolve';

export type ModerationAction =
  | 'CLEAR'
  | 'KICK'
  | 'BAN'
  | 'TIMEOUT'
  | 'WARN'
  | 'AUTOMOD'
  | 'ANTI-NUKE'
  | 'TICKET'
  | 'VERIFY';

export interface ModerationRecord {
  action: ModerationAction;
  moderator: User;
  target?: User;
  reason?: string;
  /** e.g. "10 minutes", "24 messages". */
  detail?: string;
}

/**
 * Writes a moderation case to #moderation and the bot log.
 *
 * Two destinations on purpose: #moderation is the human-readable case history
 * staff actually read, #bot-logs is the machine-shaped stream. Failing to
 * write either must never undo an action that has already been taken, so this
 * function does not throw.
 */
export async function recordModeration(guild: Guild, record: ModerationRecord): Promise<void> {
  const summary = [
    record.target ? `${record.target.tag} (${record.target.id})` : null,
    record.detail,
  ]
    .filter(Boolean)
    .join(' — ');

  logger.info(
    'MODERATION',
    `${record.action}: ${summary || 'n/a'} by ${record.moderator.tag}${record.reason ? ` — ${record.reason}` : ''}`,
  );

  const channel = findTextChannel(guild, 'moderation');
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(record.action === 'BAN' ? COLORS.danger : COLORS.warning)
    .setTitle(record.action)
    .setFooter({ text: BRAND.footer })
    .setTimestamp(new Date())
    .addFields({ name: 'Moderator', value: `<@${record.moderator.id}>`, inline: true });

  if (record.target) {
    embed.addFields({
      name: 'Member',
      value: `<@${record.target.id}>\n\`${escapeMarkdown(record.target.tag)}\``,
      inline: true,
    });
  }
  if (record.detail) embed.addFields({ name: 'Detail', value: record.detail, inline: true });
  embed.addFields({
    name: 'Reason',
    value: truncate(record.reason?.trim() || 'No reason given.', 1024),
  });

  await channel.send({ embeds: [embed] }).catch(() => {
    logger.warn('MODERATION', 'Could not write the case to #moderation — the action itself succeeded.');
  });
}
