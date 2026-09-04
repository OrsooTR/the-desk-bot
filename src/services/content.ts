import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild,
} from 'discord.js';
import { BRAND, COLORS, HOUSE_QUESTIONS, PRINCIPLES } from '../config/branding';
import { RULES, VERIFICATION, WELCOME } from '../config/content';
import { SERVER } from '../config/server';
import { truncate, EMBED_DESCRIPTION_LIMIT, EMBED_FIELD_LIMIT } from '../utils/format';
import { logger } from './logger';
import { resolveDeep } from './mentions';
import { findTextChannel, type PostableChannel } from './resolve';
import { state } from './state';

export interface ContentResult {
  key: string;
  status: 'created' | 'updated' | 'skipped';
  detail?: string;
}

/**
 * Publishes the welcome brief and the rules.
 *
 * Idempotent by message ID: on a second run the existing message is edited in
 * place, so pins, links and the verification button all survive. A message
 * that has been deleted by hand is simply reposted.
 */
export async function publishCommunityContent(
  guild: Guild,
  dryRun: boolean,
): Promise<ContentResult[]> {
  const results: ContentResult[] = [];

  results.push(
    await publish(guild, SERVER.welcomeChannelKey, 'welcome-message', dryRun, () => ({
      embeds: welcomeEmbeds(),
      components: [],
    })),
  );

  results.push(
    await publish(guild, SERVER.rulesChannelKey, 'rules-message', dryRun, () => ({
      embeds: rulesEmbeds(),
      components: [verificationRow()],
    })),
  );

  return results;
}

type Payload = () => {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
};

async function publish(
  guild: Guild,
  channelKey: string,
  messageKey: string,
  dryRun: boolean,
  build: Payload,
): Promise<ContentResult> {
  const channel = findTextChannel(guild, channelKey);
  if (!channel) {
    return {
      key: messageKey,
      status: 'skipped',
      detail: `#${channelKey} does not exist yet.`,
    };
  }

  const remembered = state.message(messageKey);
  const existing =
    remembered && remembered.channelId === channel.id
      ? await channel.messages.fetch(remembered.messageId).catch(() => null)
      : null;

  if (dryRun) {
    return {
      key: messageKey,
      status: existing ? 'updated' : 'created',
      detail: existing ? `would refresh the message in #${channel.name}` : `would post to #${channel.name}`,
    };
  }

  const payload = build();

  const linked = payload.embeds.map((embed) =>
    EmbedBuilder.from(resolveDeep(embed.toJSON(), guild)),
  );

  if (existing) {
    await existing.edit({ embeds: linked, components: payload.components });
    logger.info('SETUP', `Refreshed ${messageKey} in #${channel.name}`);
    return { key: messageKey, status: 'updated' };
  }

  const sent = await channel.send({ embeds: linked, components: payload.components });
  state.rememberMessage(messageKey, channel.id, sent.id);
  await pinQuietly(channel, sent.id);
  logger.info('SETUP', `Published ${messageKey} to #${channel.name}`);
  return { key: messageKey, status: 'created' };
}

/** Pinning is a nicety; a missing Manage Messages permission must not fail setup. */
async function pinQuietly(channel: PostableChannel, messageId: string): Promise<void> {
  try {
    const message = await channel.messages.fetch(messageId);
    await message.pin();
  } catch {
    logger.debug('SETUP', `Could not pin message in #${channel.name} (missing permission?)`);
  }
}

/* ── Embed builders ────────────────────────────────────────── */

export function welcomeEmbeds(): EmbedBuilder[] {
  const header = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(WELCOME.title)
    .setDescription(
      truncate(
        [WELCOME.intro, '', BRAND.rule, '', PRINCIPLES.map((p) => `• ${p}`).join('\n')].join('\n'),
        EMBED_DESCRIPTION_LIMIT,
      ),
    );

  const body = new EmbedBuilder().setColor(COLORS.neutral).addFields(
    WELCOME.sections.map((section) => ({
      name: section.heading,
      value: truncate(section.body, EMBED_FIELD_LIMIT),
    })),
  );

  const footer = new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setDescription(truncate(WELCOME.closing, EMBED_DESCRIPTION_LIMIT))
    .setFooter({ text: `${BRAND.footer} · ${BRAND.tagline}` });

  return [header, body, footer];
}

export function rulesEmbeds(): EmbedBuilder[] {
  const numbered = RULES.rules.map((rule, index) => `**${index + 1}.** ${rule}`).join('\n\n');

  const main = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(RULES.title)
    .setDescription(truncate([RULES.intro, '', numbered].join('\n'), EMBED_DESCRIPTION_LIMIT));

  const closing = new EmbedBuilder()
    .setColor(COLORS.neutral)
    .addFields(
      { name: 'ENFORCEMENT', value: truncate(RULES.enforcement, EMBED_FIELD_LIMIT) },
      {
        name: 'QUESTIONS YOU SHOULD EXPECT',
        value: truncate(
          `${HOUSE_QUESTIONS.map((question) => `• ${question}`).join('\n')}\n\nAsking them is not hostility. It is the standard here.`,
          EMBED_FIELD_LIMIT,
        ),
      },
    )
    .setFooter({ text: `${BRAND.footer} · accept below to unlock the server` });

  return [main, closing];
}

export function verificationRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFICATION.customId)
      .setLabel(VERIFICATION.buttonLabel)
      .setStyle(ButtonStyle.Secondary),
  );
}
