import { Events, type Client } from 'discord.js';
import { logger } from '../services/logger';
import { onAutoModerationActionExecution } from './autoModExecution';
import { onGuildMemberAdd } from './guildMemberAdd';
import { onInteractionCreate } from './interactionCreate';
import { onVoiceStateUpdate } from '../services/voiceRooms';
import { registerProtectionHandlers } from './protection';
import { onReady } from './ready';

/**
 * Wires every gateway listener.
 *
 * Each handler is wrapped so a thrown error is logged instead of surfacing as
 * an unhandled rejection: one bad interaction must never take the process down.
 */
export function registerEventHandlers(client: Client): void {
  client.once(Events.ClientReady, (ready) => {
    void guard('ready', () => onReady(ready));
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void guard('interactionCreate', () => onInteractionCreate(interaction));
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void guard('guildMemberAdd', () => onGuildMemberAdd(member));
  });

  client.on(Events.VoiceStateUpdate, (before, after) => {
    void guard('voiceStateUpdate', () => onVoiceStateUpdate(before, after));
  });

  client.on(Events.AutoModerationActionExecution, (execution) => {
    void guard('autoModerationActionExecution', () =>
      onAutoModerationActionExecution(execution),
    );
  });

  client.on(Events.Error, (error) => {
    logger.error('ERROR', 'Discord client error', error);
  });

  client.on(Events.Warn, (message) => {
    logger.warn('BOOT', `Discord client warning: ${message}`, { discord: false });
  });

  registerProtectionHandlers(client);
}

async function guard(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.error('ERROR', `Handler "${name}" threw`, error);
  }
}
