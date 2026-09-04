import { Events, type Client, type Guild } from 'discord.js';
import { env } from '../config/env';
import { PROTECTION, type ProtectedAction } from '../config/protection';
import { logger } from '../services/logger';
import { noteAction } from '../services/protection';

/**
 * Gateway listeners for the anti-nuke watcher.
 *
 * Kept separate from the feature handlers so the whole subsystem can be
 * switched off in one place, and so it is obvious at a glance which events
 * exist purely for defence.
 */
export function registerProtectionHandlers(client: Client): void {
  if (!PROTECTION.enabled) {
    logger.warn('BOOT', 'Anti-nuke is disabled in config/protection.ts', { discord: false });
    return;
  }

  // ChannelDelete also fires for DM channels, which have no guild.
  client.on(Events.ChannelDelete, (channel) => {
    if ('guild' in channel) report(channel.guild, 'channelDelete');
  });
  client.on(Events.ChannelCreate, (channel) => report(channel.guild, 'channelCreate'));
  client.on(Events.GuildRoleDelete, (role) => report(role.guild, 'roleDelete'));
  client.on(Events.GuildRoleCreate, (role) => report(role.guild, 'roleCreate'));
  client.on(Events.GuildRoleUpdate, (_old, role) => report(role.guild, 'roleUpdate'));
  client.on(Events.GuildBanAdd, (ban) => report(ban.guild, 'ban'));
  client.on(Events.WebhooksUpdate, (channel) => report(channel.guild, 'webhookCreate'));

  // A kick is a member removal, but so is leaving voluntarily. The audit log
  // lookup inside noteAction only matches an actual MemberKick entry from the
  // last few seconds, so a wave of people simply leaving cannot trip this.
  client.on(Events.GuildMemberRemove, (member) => report(member.guild, 'kick'));

  logger.info('BOOT', `Anti-nuke armed (response: ${PROTECTION.response})`, { discord: false });
}

function report(guild: Guild, action: ProtectedAction): void {
  if (guild.id !== env().guildId) return;

  // Never let a defence handler throw into the gateway loop.
  void noteAction(guild, action).catch((error: unknown) => {
    logger.error('ERROR', `Anti-nuke handler for "${action}" threw`, error);
  });
}
