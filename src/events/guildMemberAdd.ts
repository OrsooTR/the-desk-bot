import type { GuildMember } from 'discord.js';
import { env } from '../config/env';
import { assignJoinRole } from '../services/membership';
import { logger } from '../services/logger';

/**
 * Assign the join role. Requires the Server Members privileged intent —
 * without it this event never fires and new members land with no roles at all,
 * which is why the README makes it a hard requirement rather than a suggestion.
 */
export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  if (member.guild.id !== env().guildId) return;

  try {
    await assignJoinRole(member);
  } catch (error) {
    logger.error('MEMBER', `Failed to process the join of ${member.user.tag}`, error);
  }
}
