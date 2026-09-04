import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { BRAND, COLORS, PRINCIPLES } from '../../config/branding';
import { RESOURCE_TOPICS, findTopic, type ResourceTopic } from '../../config/resources';
import type { Command, CommandContext } from '../../core/command';
import { truncate, EMBED_DESCRIPTION_LIMIT, EMBED_FIELD_LIMIT } from '../../utils/format';

/**
 * /resources — the curated starting library.
 *
 * Answers privately by default so the channel does not fill with the same
 * booklist; `share: true` posts it for everyone when it is genuinely part of
 * the conversation.
 */
export const resourcesCommand: Command = {
  access: 'member',
  defer: 'none',
  data: new SlashCommandBuilder()
    .setName('resources')
    .setDescription('Curated books, papers, tools and data.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('Narrow it to one area')
        .addChoices(
          ...RESOURCE_TOPICS.map((topic) => ({ name: topic.label, value: topic.key })),
        ),
    )
    .addBooleanOption((option) =>
      option.setName('share').setDescription('Post it in the channel instead of privately'),
    ),

  async execute({ interaction }: CommandContext): Promise<void> {
    const topicKey = interaction.options.getString('topic');
    const share = interaction.options.getBoolean('share') ?? false;

    const topic = topicKey ? findTopic(topicKey) : null;
    const embed = topic ? topicEmbed(topic) : overviewEmbed();

    await interaction.reply({
      embeds: [embed],
      ...(share ? {} : { flags: MessageFlags.Ephemeral }),
    });
  },
};

function topicEmbed(topic: ResourceTopic): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(topic.label.toUpperCase())
    .setDescription(topic.summary)
    .addFields(
      topic.entries.map((entry) => ({
        name: truncate(entry.by ? `${entry.title} — ${entry.by}` : entry.title, 256),
        value: truncate(entry.url ? `${entry.note}\n${entry.url}` : entry.note, EMBED_FIELD_LIMIT),
      })),
    )
    .setFooter({ text: `${BRAND.footer} · add your own in #resources` });
}

function overviewEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${BRAND.name} — RESOURCES`)
    .setDescription(
      truncate(
        [
          'Foundations, not shortcuts. Nothing here hands you an edge — these are the tools you build one with.',
          '',
          PRINCIPLES.slice(0, 3)
            .map((principle) => `_${principle}_`)
            .join('\n'),
          '',
          'Pick a topic with `/resources topic:`',
        ].join('\n'),
        EMBED_DESCRIPTION_LIMIT,
      ),
    )
    .addFields(
      RESOURCE_TOPICS.map((topic) => ({
        name: topic.label,
        value: truncate(
          `${topic.summary}\n${topic.entries
            .slice(0, 2)
            .map((entry) => `• ${entry.title}`)
            .join('\n')}`,
          EMBED_FIELD_LIMIT,
        ),
      })),
    )
    .setFooter({ text: `${BRAND.footer} · ${BRAND.tagline}` });
}
