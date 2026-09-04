import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../../config/branding';
import { STRIKE_DECAY_DAYS, findOffence, resolveLadder } from '../../config/moderation';
import type { Command, CommandContext } from '../../core/command';
import { assertAccess } from '../../permissions/guards';
import { activePoints, activeStrikes, allStrikes, clearStrikes } from '../../services/warnings';
import { recordModeration } from '../../services/moderationLog';
import { plural, timestamp, truncate, EMBED_DESCRIPTION_LIMIT } from '../../utils/format';

/** /warnings — read or clear a member's record. */
export const warningsCommand: Command = {
  access: 'moderator',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Show or clear a member\u2019s strike record.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Show a member\u2019s strikes')
        .addUserOption((option) =>
          option.setName('user').setDescription('The member').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Wipe a member\u2019s record. Admin only.')
        .addUserOption((option) =>
          option.setName('user').setDescription('The member').setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Why').setRequired(true),
        ),
    ),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    const user = interaction.options.getUser('user', true);

    if (interaction.options.getSubcommand() === 'clear') {
      assertAccess(member, 'admin', 'warnings clear');
      const reason = interaction.options.getString('reason', true);
      const removed = clearStrikes(user.id);

      await recordModeration(guild, {
        action: 'WARN',
        moderator: member.user,
        target: user,
        reason,
        detail: `record cleared (${plural(removed, 'strike')})`,
      });

      await interaction.editReply(
        `Cleared ${plural(removed, 'strike')} from **${user.tag}**.`,
      );
      return;
    }

    const active = activeStrikes(user.id);
    const history = allStrikes(user.id);
    const points = activePoints(user.id);
    const step = resolveLadder(points);

    const embed = new EmbedBuilder()
      .setColor(points >= 5 ? COLORS.danger : points > 0 ? COLORS.warning : COLORS.success)
      .setTitle(`RECORD — ${user.tag}`)
      .setDescription(
        truncate(
          [
            `**Active points:** ${points}`,
            `**Current standing:** ${step ? step.summary : 'clean'}`,
            `**Active strikes:** ${active.length} of ${history.length} on record`,
            '',
            active.length === 0
              ? 'No active strikes.'
              : active
                  .slice(0, 15)
                  .map((strike) => {
                    const offence = findOffence(strike.offenceKey);
                    return `${timestamp(new Date(strike.at), 'D')} — **${offence?.label ?? strike.offenceKey}** (${strike.points} pt)${strike.automatic ? ' · auto' : ''}\n\u2003${truncate(strike.reason, 150)}`;
                  })
                  .join('\n\n'),
          ].join('\n'),
          EMBED_DESCRIPTION_LIMIT,
        ),
      )
      .setFooter({ text: `Points expire after ${STRIKE_DECAY_DAYS} days` });

    await interaction.editReply({ embeds: [embed] });
  },
};
