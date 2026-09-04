import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { BRAND, COLORS } from '../../config/branding';
import { FAQ, findFaq, searchFaq } from '../../config/faq';
import type { Command, CommandContext } from '../../core/command';
import { truncate, EMBED_DESCRIPTION_LIMIT, EMBED_FIELD_LIMIT } from '../../utils/format';

/**
 * /faq — the standing answers, searchable.
 *
 * Answers privately by default so a repeated question does not fill a channel;
 * `share: true` posts it publicly, which is what a moderator wants when they
 * are answering someone.
 */
export const faqCommand: Command = {
  access: 'everyone',
  defer: 'none',
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Answers to the questions that come up most.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('Jump straight to one answer')
        .addChoices(
          ...FAQ.slice(0, 25).map((entry) => ({
            name: truncate(entry.question, 100),
            value: entry.key,
          })),
        ),
    )
    .addStringOption((option) =>
      option.setName('search').setDescription('Search the FAQ text'),
    )
    .addBooleanOption((option) =>
      option.setName('share').setDescription('Post it in the channel instead of privately'),
    ),

  async execute({ interaction }: CommandContext): Promise<void> {
    const topic = interaction.options.getString('topic');
    const query = interaction.options.getString('search');
    const share = interaction.options.getBoolean('share') ?? false;

    const embed = topic ? single(topic) : query ? results(query) : overview();

    await interaction.reply({
      embeds: [embed],
      ...(share ? {} : { flags: MessageFlags.Ephemeral }),
    });
  },
};

function single(key: string): EmbedBuilder {
  const entry = findFaq(key);
  if (!entry) return notFound();

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(truncate(entry.question, 256))
    .setDescription(truncate(entry.answer, EMBED_DESCRIPTION_LIMIT))
    .setFooter({ text: `${BRAND.footer} · ${entry.section}` });
}

function results(query: string): EmbedBuilder {
  const matches = searchFaq(query);
  if (matches.length === 0) return notFound();
  if (matches.length === 1 && matches[0]) return single(matches[0].key);

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`FAQ — ${matches.length} matches for "${truncate(query, 60)}"`)
    .addFields(
      matches.slice(0, 8).map((entry) => ({
        name: truncate(entry.question, 256),
        value: truncate(entry.answer, 300),
      })),
    )
    .setFooter({ text: `${BRAND.footer} · narrow it with /faq topic:` });
}

function overview(): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${BRAND.name} — FAQ`)
    .setDescription('Pick a question with `/faq topic:`, or search with `/faq search:`.');

  const sections = [...new Set(FAQ.map((entry) => entry.section))];
  for (const section of sections) {
    embed.addFields({
      name: section.toUpperCase(),
      value: truncate(
        FAQ.filter((entry) => entry.section === section)
          .map((entry) => `• ${entry.question}`)
          .join('\n'),
        EMBED_FIELD_LIMIT,
      ),
    });
  }

  return embed.setFooter({ text: `${BRAND.footer} · not here? open a ticket` });
}

function notFound(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setDescription(
      'Nothing in the FAQ matches that. Open a ticket in the support channel and a moderator will answer.',
    );
}
