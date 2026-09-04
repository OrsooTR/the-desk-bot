import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../../config/branding';
import { OFFENCES, STRIKE_DECAY_DAYS } from '../../config/moderation';
import type { Command, CommandContext } from '../../core/command';
import { canActOn } from '../../permissions/guards';
import { fileStrike } from '../../services/warnings';
import { OperationalError } from '../../utils/errors';

/**
 * /warn — file a strike.
 *
 * The moderator picks the offence; the ladder picks the consequence. That
 * separation is the point: the same behaviour costs the same regardless of
 * who is on duty or how irritating the member was being.
 */
export const warnCommand: Command = {
  access: 'moderator',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('File a strike against a member. The ladder decides the consequence.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('The member').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('offence')
        .setDescription('What rule was broken')
        .setRequired(true)
        .addChoices(
          ...OFFENCES.slice(0, 25).map((offence) => ({
            name: `${offence.label} (${offence.immediate ? 'immediate ' + offence.immediate : offence.points + ' pt'})`,
            value: offence.key,
          })),
        ),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('What actually happened. Shown to the member.')
        .setRequired(true),
    ),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    const user = interaction.options.getUser('user', true);
    const offenceKey = interaction.options.getString('offence', true);
    const reason = interaction.options.getString('reason', true);

    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) throw new OperationalError('That member is not in this server.');
    if (target.user.bot) throw new OperationalError('Bots do not get warnings.');

    const permitted = canActOn(member, target);
    if (!permitted.ok) throw new OperationalError(permitted.reason);

    const outcome = await fileStrike(guild, target, member.user, offenceKey, reason);

    const embed = new EmbedBuilder()
      .setColor(outcome.problem ? COLORS.warning : COLORS.success)
      .setTitle('STRIKE FILED')
      .addFields(
        { name: 'Member', value: `<@${user.id}>`, inline: true },
        { name: 'Offence', value: outcome.offence.label, inline: true },
        { name: 'Points', value: `+${outcome.offence.points} → ${outcome.activePoints}`, inline: true },
        { name: 'Applied', value: outcome.applied },
        { name: 'Reason', value: reason },
      )
      .setFooter({ text: `Points expire after ${STRIKE_DECAY_DAYS} days` });

    if (outcome.problem) embed.addFields({ name: 'Note', value: outcome.problem });

    await interaction.editReply({ embeds: [embed] });
  },
};
