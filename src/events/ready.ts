import type { Client } from 'discord.js';
import { env } from '../config/env';
import { SERVER } from '../config/server';
import { deployCommands } from '../core/deploy';
import { logger } from '../services/logger';
import { findLogChannel } from '../services/resolve';
import { startScheduler } from '../services/scheduler';
import { sweepOrphanedRooms } from '../services/voiceRooms';

/**
 * Startup. Anything that must be true before the bot is useful is checked
 * here, and reported clearly rather than failing later inside a command.
 */
export async function onReady(client: Client<true>): Promise<void> {
  const { guildId, clientId, token, autoDeployCommands } = env();

  logger.attach(client, guildId);
  logger.info('BOOT', `Logged in as ${client.user.tag}`, { discord: false });

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    logger.error(
      'BOOT',
      `I am not a member of guild ${guildId}. Check GUILD_ID, or invite the bot.`,
    );
    return;
  }

  if (autoDeployCommands) {
    try {
      await deployCommands(token, clientId, guildId);
    } catch (error) {
      logger.error('BOOT', 'Slash command registration failed', error);
    }
  }

  const fullGuild = await guild.fetch();
  await fullGuild.channels.fetch();
  await sweepOrphanedRooms(fullGuild);
  startScheduler(client);
  const hasStructure = findLogChannel(fullGuild) !== null;

  logger.info(
    'BOOT',
    hasStructure
      ? `Connected to ${fullGuild.name}. Structure detected.`
      : `Connected to ${fullGuild.name}. No #${SERVER.logChannelKey} yet — run /setup to provision the server.`,
  );
}
