import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type TextChannel,
} from 'discord.js';
import { BRAND, COLORS } from '../../config/branding';
import { REVIEW_FOOTER, REVIEW_SECTIONS } from '../../config/review';
import type { Command, CommandContext } from '../../core/command';
import { OperationalError } from '../../utils/errors';
import { escapeMarkdown, truncate, EMBED_FIELD_LIMIT } from '../../utils/format';

/**
 * /review — the structured trade review template.
 *
 * The template is posted, then a thread is opened on it. The review happens in
 * the thread, so #trade-review stays a readable index of reviews rather than a
 * wall of half-finished ones.
 */
export const reviewCommand: Command = {
  access: 'member',
  defer: 'none',
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Post the structured trade review template.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('instrument')
        .setDescription('What did you trade? e.g. ES, NQ, EURUSD, BTC')
        .setRequired(true)
        .setMaxLength(40),
    )
    .addStringOption((option) =>
      option
        .setName('direction')
        .setDescription('Long or short')
        .addChoices({ name: 'Long', value: 'Long' }, { name: 'Short', value: 'Short' }),
    )
    .addStringOption((option) =>
      option
        .setName('session')
        .setDescription('Which session')
        .addChoices(
          { name: 'Asia', value: 'Asia' },
          { name: 'London', value: 'London' },
          { name: 'New York', value: 'New York' },
          { name: 'Overnight', value: 'Overnight' },
          { name: 'Other', value: 'Other' },
        ),
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Get the raw template privately instead of posting it'),
    ),

  async execute({ interaction, member }: CommandContext): Promise<void> {
    const instrument = interaction.options.getString('instrument', true).trim();
    const direction = interaction.options.getString('direction') ?? '—';
    const session = interaction.options.getString('session') ?? '—';
    const isPrivate = interaction.options.getBoolean('private') ?? false;

    if (isPrivate) {
      await interaction.reply({
        content: truncate(plainTemplate(instrument, session, direction), 1990),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new OperationalError('Post reviews in a normal text channel.');
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('TRADE REVIEW')
      .setDescription(
        [
          `**Instrument:** ${escapeMarkdown(instrument)}`,
          `**Session:** ${session}`,
          `**Direction:** ${direction}`,
          `**Trader:** <@${member.id}>`,
        ].join('\n'),
      )
      .addFields(
        REVIEW_SECTIONS.map((section) => ({
          name: section.heading,
          value: truncate(section.prompts.map((prompt) => `• ${prompt}`).join('\n'), EMBED_FIELD_LIMIT),
        })),
      )
      .setFooter({ text: `${BRAND.footer} · ${REVIEW_FOOTER}` })
      .setTimestamp(new Date());

    const message = await (channel as TextChannel).send({ embeds: [embed] });

    const threadName = truncate(`Review — ${instrument} — ${member.displayName}`, 100);
    const thread = await message
      .startThread({ name: threadName, autoArchiveDuration: 10080, reason: 'Trade review' })
      .catch(() => null);

    await interaction.editReply(
      thread
        ? `Template posted. Fill it in here: ${thread.url}`
        : 'Template posted. Reply to it with your review.',
    );
  },
};

/** Plain-text version, for people who would rather write it in their editor. */
function plainTemplate(instrument: string, session: string, direction: string): string {
  const lines: string[] = [
    BRAND.rule,
    'TRADE REVIEW',
    BRAND.rule,
    '',
    `Instrument: ${instrument}`,
    `Session: ${session}`,
    `Direction: ${direction}`,
    '',
  ];

  for (const section of REVIEW_SECTIONS) {
    lines.push(section.heading);
    for (const prompt of section.prompts) lines.push(`  ${prompt}`);
    lines.push('');
  }

  lines.push(REVIEW_FOOTER);
  return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
}
