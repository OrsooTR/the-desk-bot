import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ActionRowBuilder,
  type ButtonBuilder,
  type ForumChannel,
  type Guild,
} from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import { CHANNEL_GUIDES, type ChannelGuide } from '../config/channelGuides';
import { FAQ, faqSections } from '../config/faq';
import { SERVER, allChannels } from '../config/server';
import { chunkLines, truncate, EMBED_DESCRIPTION_LIMIT, EMBED_FIELD_LIMIT } from '../utils/format';
import { logger } from './logger';
import { resolveDeep } from './mentions';
import { findChannel, findTextChannel } from './resolve';
import { state } from './state';
import { rolePanels } from './selfRoleService';
import { ticketPanel } from './tickets';

/* ────────────────────────────────────────────────────────────
 * Standing content
 *
 * The pinned card at the top of each channel, the FAQ, and the ticket panel.
 * All published idempotently: the message ID is remembered, so a re-run edits
 * what is already there instead of stacking duplicates.
 *
 * Forums cannot hold a plain message, so their card is posted as a pinned
 * forum post instead.
 * ──────────────────────────────────────────────────────────── */

export interface PublishResult {
  key: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped' | 'failed';
  detail?: string;
}

/** The server's own description, shown in the discovery/invite card. */
export async function publishGuildDescription(
  guild: Guild,
  dryRun: boolean,
): Promise<PublishResult> {
  const description =
    'An international trading community built on research, process and execution. ' +
    'No signals, no guarantees, no shortcuts. English first, with a dedicated Italian section.';

  if (!guild.features.includes('COMMUNITY')) {
    return { key: 'guild-description', status: 'skipped', detail: 'requires Community mode' };
  }
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return {
      key: 'guild-description',
      status: 'skipped',
      detail: 'I need the Manage Server permission',
    };
  }
  if (guild.description === description) {
    return { key: 'guild-description', status: 'unchanged' };
  }
  if (dryRun) {
    return { key: 'guild-description', status: 'updated', detail: 'would be set' };
  }

  try {
    await guild.edit({ description, reason: 'THE DESK server profile' });
    logger.info('SETUP', 'Updated the server description');
    return { key: 'guild-description', status: 'updated' };
  } catch {
    return { key: 'guild-description', status: 'failed', detail: 'Discord rejected the change' };
  }
}

/** One pinned card per channel that defines a guide. */
export async function publishChannelGuides(
  guild: Guild,
  dryRun: boolean,
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  for (const { channel: definition } of allChannels()) {
    const guide = CHANNEL_GUIDES[definition.key];
    if (!guide) continue;

    const live = findChannel(guild, definition.key);
    if (!live) {
      results.push({ key: definition.key, status: 'skipped', detail: 'channel missing' });
      continue;
    }

    const embed = guideEmbed(definition.name, guide);

    // The ticket channel's card carries the button, so it doubles as the panel.
    const isTicketChannel = definition.key === SERVER.ticketChannelKey;
    const panel = isTicketChannel ? ticketPanel() : null;

    try {
      if (live.type === ChannelType.GuildForum) {
        results.push(await publishForumGuide(live, definition.key, embed, dryRun));
      } else if (live.type === ChannelType.GuildText || live.type === ChannelType.GuildAnnouncement) {
        results.push(
          await publishMessage(
            guild,
            definition.key,
            `guide:${definition.key}`,
            panel ? panel.embeds : [embed],
            panel ? panel.components : [],
            dryRun,
          ),
        );
      } else {
        results.push({ key: definition.key, status: 'skipped', detail: 'not a postable channel' });
      }
    } catch (error) {
      logger.error('SETUP', `Could not publish the guide for ${definition.name}`, error);
      results.push({ key: definition.key, status: 'failed' });
    }
  }

  return results;
}

/** The self-assignable role menus. */
export async function publishRolePanels(
  guild: Guild,
  dryRun: boolean,
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  for (const panel of rolePanels()) {
    results.push(
      await publishMessage(
        guild,
        SERVER.rolesChannelKey,
        panel.key,
        panel.embeds,
        panel.components as ActionRowBuilder<ButtonBuilder>[],
        dryRun,
      ),
    );
  }

  return results;
}

/** The FAQ, as pinned embeds in #faq — one per section. */
export async function publishFaq(guild: Guild, dryRun: boolean): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  const header = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${BRAND.name} — FAQ`)
    .setDescription(
      'The questions that come up most, answered once. Run `/faq` to search them, or open a ticket if yours is not here.',
    )
    .setFooter({ text: BRAND.footer });

  results.push(
    await publishMessage(guild, SERVER.faqChannelKey, 'faq:header', [header], [], dryRun),
  );

  for (const section of faqSections()) {
    const entries = FAQ.filter((entry) => entry.section === section);
    const embed = new EmbedBuilder()
      .setColor(COLORS.neutral)
      .setTitle(section.toUpperCase())
      .addFields(
        entries.map((entry) => ({
          name: truncate(entry.question, 256),
          value: truncate(entry.answer, EMBED_FIELD_LIMIT),
        })),
      );

    results.push(
      await publishMessage(
        guild,
        SERVER.faqChannelKey,
        `faq:${slug(section)}`,
        [embed],
        [],
        dryRun,
      ),
    );
  }

  return results;
}

/* ── Internals ─────────────────────────────────────────────── */

function guideEmbed(channelName: string, guide: ChannelGuide): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setTitle(channelName.replace(/^[^\w]+/u, '').toUpperCase())
    .setDescription(truncate(guide.headline, EMBED_DESCRIPTION_LIMIT));

  if (guide.belongs.length > 0) {
    embed.addFields({
      name: 'WHAT BELONGS HERE',
      value: truncate(guide.belongs.map((line) => `• ${line}`).join('\n'), EMBED_FIELD_LIMIT),
    });
  }
  if (guide.avoid && guide.avoid.length > 0) {
    embed.addFields({
      name: 'WHAT DOES NOT',
      value: truncate(guide.avoid.map((line) => `• ${line}`).join('\n'), EMBED_FIELD_LIMIT),
    });
  }
  if (guide.standard) {
    embed.addFields({ name: 'STANDARD', value: truncate(guide.standard, EMBED_FIELD_LIMIT) });
  }

  return embed.setFooter({ text: BRAND.footer });
}

/**
 * Publish or refresh a single bot-owned message, remembered by key.
 * A message deleted by hand is simply reposted on the next run.
 */
async function publishMessage(
  guild: Guild,
  channelKey: string,
  messageKey: string,
  embeds: EmbedBuilder[],
  components: ActionRowBuilder<ButtonBuilder>[],
  dryRun: boolean,
): Promise<PublishResult> {
  const channel = findTextChannel(guild, channelKey);
  if (!channel) return { key: messageKey, status: 'skipped', detail: `#${channelKey} is missing` };

  const remembered = state.message(messageKey);
  const existing =
    remembered && remembered.channelId === channel.id
      ? await channel.messages.fetch(remembered.messageId).catch(() => null)
      : null;

  if (dryRun) {
    return { key: messageKey, status: existing ? 'unchanged' : 'created', detail: `#${channel.name}` };
  }

  // {{#channel}} and {{@role}} placeholders become real links only now, when
  // the ids exist. See services/mentions.ts.
  const linked = resolveEmbeds(embeds, guild);

  if (existing) {
    await existing.edit({ embeds: linked, components });
    return { key: messageKey, status: 'updated' };
  }

  const sent = await channel.send({ embeds: linked, components });
  state.rememberMessage(messageKey, channel.id, sent.id);
  await sent.pin().catch(() => undefined);
  logger.info('SETUP', `Published ${messageKey} to #${channel.name}`);
  return { key: messageKey, status: 'created' };
}

/**
 * A forum has no message list, so its card is the first post — created once,
 * then pinned and edited in place.
 */
async function publishForumGuide(
  forum: ForumChannel,
  channelKey: string,
  embed: EmbedBuilder,
  dryRun: boolean,
): Promise<PublishResult> {
  const messageKey = `guide:${channelKey}`;
  const remembered = state.message(messageKey);

  if (remembered) {
    const thread = await forum.threads.fetch(remembered.channelId).catch(() => null);
    const starter = thread ? await thread.fetchStarterMessage().catch(() => null) : null;
    if (starter) {
      if (dryRun) return { key: messageKey, status: 'unchanged' };
      await starter.edit({ embeds: [embed] });
      return { key: messageKey, status: 'updated' };
    }
  }

  if (dryRun) return { key: messageKey, status: 'created', detail: 'would open a pinned post' };

  const post = await forum.threads.create({
    name: 'How this channel works',
    message: { embeds: [embed] },
    reason: 'Channel guide',
  });

  await post.pin().catch(() => undefined);
  const starter = await post.fetchStarterMessage().catch(() => null);
  state.rememberMessage(messageKey, post.id, starter?.id ?? post.id);
  logger.info('SETUP', `Published the guide post in ${forum.name}`);
  return { key: messageKey, status: 'created' };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Convenience for the setup report: collapse many results into counts. */
export function summarisePublishing(results: PublishResult[]): string {
  const counts = new Map<string, number>();
  for (const result of results) counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  return (
    chunkLines([...counts.entries()].map(([status, count]) => `${count} ${status}`), 200)[0] ?? '—'
  );
}

/** Resolve `{{#channel}}` / `{{@role}}` placeholders inside built embeds. */
function resolveEmbeds(embeds: EmbedBuilder[], guild: Guild): EmbedBuilder[] {
  return embeds.map((embed) => EmbedBuilder.from(resolveDeep(embed.toJSON(), guild)));
}
