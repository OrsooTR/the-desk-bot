import { REST, Routes } from 'discord.js';
import { registry } from '../commands';
import { logger } from '../services/logger';

/**
 * Registers the command set to a single guild.
 *
 * Guild-scoped rather than global: guild commands propagate instantly, which
 * matters when you are iterating, and this bot is built for one server. Moving
 * to global registration is a one-line change to the route below.
 */
export async function deployCommands(
  token: string,
  clientId: string,
  guildId: string,
): Promise<number> {
  const rest = new REST({ version: '10' }).setToken(token);
  const body = registry.toJSON();

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });

  logger.info('BOOT', `Registered ${body.length} slash commands to guild ${guildId}`, {
    discord: false,
  });
  return body.length;
}
