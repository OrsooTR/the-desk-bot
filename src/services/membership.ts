import { MessageFlags, type ButtonInteraction, type GuildMember } from 'discord.js';
import { VERIFICATION } from '../config/content';
import { SERVER } from '../config/server';
import { toUserMessage } from '../utils/errors';
import { logger } from './logger';
import { findRole } from './resolve';

/* ────────────────────────────────────────────────────────────
 * Membership lifecycle
 *
 * join  → @New Member  (welcome, rules, general)
 * accept the rules → @Member  (full community access)
 *
 * Kept deliberately small. When this grows into a real onboarding flow —
 * screening, role selection, an application form — it slots in here without
 * touching the provisioner or the command layer.
 * ──────────────────────────────────────────────────────────── */

/** Assigns the join role. Silent no-op if the member already holds it. */
export async function assignJoinRole(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const role = findRole(member.guild, SERVER.joinRole);
  if (!role) {
    logger.warn('MEMBER', `Cannot assign the join role: @${SERVER.joinRole} does not exist. Run /setup.`);
    return;
  }

  if (member.roles.cache.has(role.id)) return;

  try {
    await member.roles.add(role, 'Joined the server');
    logger.info('MEMBER', `${member.user.tag} joined — assigned @${role.name}`);
  } catch (error) {
    logger.error('MEMBER', `Could not assign @${role.name} to ${member.user.tag}`, error);
  }
}

/**
 * Promotes New Member → Member when the rules are accepted.
 *
 * Ordering matters: the verified role is added before the join role is removed,
 * so a failure halfway through leaves the member with more access rather than
 * none at all.
 */
export async function handleVerification(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member;
  if (!interaction.inCachedGuild() || !member || !('roles' in member)) {
    await interaction.reply({
      content: 'Verification only works inside the server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildMember = await interaction.guild.members.fetch(interaction.user.id);
  const verified = findRole(interaction.guild, SERVER.verifiedRole);
  const pending = findRole(interaction.guild, SERVER.joinRole);

  if (!verified) {
    logger.warn('MEMBER', `Verification failed: @${SERVER.verifiedRole} does not exist. Run /setup.`);
    await interaction.reply({
      content: 'Verification is not configured yet. A staff member has been notified.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (guildMember.roles.cache.has(verified.id)) {
    await interaction.reply({
      content: VERIFICATION.alreadyVerified,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await guildMember.roles.add(verified, 'Accepted the community rules');
    if (pending && guildMember.roles.cache.has(pending.id)) {
      await guildMember.roles.remove(pending, 'Accepted the community rules');
    }

    logger.info('MEMBER', `${guildMember.user.tag} accepted the rules — promoted to @${verified.name}`);
    await interaction.reply({ content: VERIFICATION.success, flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error('MEMBER', `Verification failed for ${guildMember.user.tag}`, error);
    const { message } = toUserMessage(error);
    await interaction.reply({
      content: `${message} Ask a moderator to verify you manually.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
