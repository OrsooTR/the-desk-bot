import { ChannelType, Client, GatewayIntentBits, type Guild, type GuildBasedChannel } from 'discord.js';
import { env } from '../config/env';
import { SERVER, allChannels } from '../config/server';
import { logger } from '../services/logger';
import { syncServer } from '../services/provisioning/provisioner';
import { DISCORD_TYPE, findChannelAnyType } from '../services/resolve';
import { state } from '../services/state';
import { describeError } from '../utils/errors';

/* ────────────────────────────────────────────────────────────
 * Channel type migration — `npm run migrate:types`
 *
 * Discord cannot convert a text channel into a forum. The only way to change
 * that type is to delete and recreate, which is exactly the operation /setup
 * refuses to perform: an idempotent sync that can delete channels is one bad
 * config edit away from destroying a community's history.
 *
 * So it lives here instead: a separate, explicit, opt-in command that
 *
 *   - lists precisely what it would delete and why,
 *   - counts the human messages in each channel first,
 *   - REFUSES to touch anything containing human messages unless --force,
 *   - does nothing at all without --confirm.
 *
 * Deleted messages are not recoverable through the Discord API. Read the plan
 * before confirming it.
 * ──────────────────────────────────────────────────────────── */

const confirm = process.argv.includes('--confirm');
const force = process.argv.includes('--force');

interface Candidate {
  key: string;
  channel: GuildBasedChannel;
  currentType: string;
  wantedType: string;
  humanMessages: number;
  /** Why it is up for deletion. */
  reason: 'type change' | 'removed from blueprint';
}

async function main(): Promise<void> {
  const { token, guildId } = env();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await new Promise<void>((resolve, reject) => {
    client.once('clientReady', () => resolve());
    client.once('error', reject);
    client.login(token).catch(reject);
  });

  const guild = await client.guilds.fetch(guildId);
  const full = await guild.fetch();
  await full.channels.fetch();

  console.log(`\nConnected as ${client.user?.tag ?? '?'} — ${full.name}\n`);

  const candidates = await findCandidates(full);

  if (candidates.length === 0) {
    console.log('Every channel already has the type the blueprint asks for. Nothing to migrate.');
    await client.destroy();
    return;
  }

  console.log(`${candidates.length} channel(s) would be DELETED:\n`);
  for (const candidate of candidates) {
    const risk =
      candidate.humanMessages > 0
        ? `  ⚠ ${candidate.humanMessages} human message(s) would be LOST`
        : '  (empty — nothing to lose)';
    console.log(`  ${candidate.channel.name}   [${candidate.reason}]`);
    console.log(`      ${candidate.currentType} → ${candidate.wantedType}`);
    console.log(risk);
  }
  console.log(
    '\nType changes are recreated from the blueprint afterwards. Removals are not.',
  );

  const risky = candidates.filter((candidate) => candidate.humanMessages > 0);
  if (risky.length > 0 && !force) {
    console.log(
      `\nREFUSING TO PROCEED: ${risky.length} channel(s) contain messages written by people.`,
    );
    console.log('Move that content somewhere safe first, or re-run with --force to accept the loss.');
    await client.destroy();
    process.exitCode = 1;
    return;
  }

  if (!confirm) {
    console.log('\nDry run. Nothing was changed.');
    console.log('Re-run with --confirm to delete and recreate these channels:');
    console.log('  npm run migrate:types -- --confirm\n');
    await client.destroy();
    return;
  }

  console.log('\nDeleting…');
  for (const candidate of candidates) {
    try {
      await candidate.channel.delete(`Type migration to ${candidate.wantedType}`);
      // Drop the stale ID so the next resolution does not chase a dead channel.
      state.update((current) => {
        delete current.channels[candidate.key];
      });
      console.log(`  deleted ${candidate.channel.name}`);
      logger.info('SETUP', `Migration deleted ${candidate.channel.name} for a type change`);
    } catch (error) {
      console.error(`  FAILED to delete ${candidate.channel.name}: ${describeError(error)}`);
    }
  }

  console.log('\nRecreating from the blueprint…');
  logger.attach(client, guildId);
  const report = await syncServer(full, { dryRun: false, actorTag: 'CLI migration' });

  const created = report.outcomes.filter((outcome) => outcome.status === 'created');
  for (const outcome of created) console.log(`  created ${outcome.label}`);
  for (const warning of report.warnings) console.log(`  ! ${warning}`);

  const failed = report.outcomes.filter((outcome) => outcome.status === 'failed');
  for (const outcome of failed) console.error(`  FAILED ${outcome.label}: ${outcome.error ?? ''}`);

  console.log('\nMigration complete.');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await client.destroy();
  if (failed.length > 0) process.exitCode = 1;
}

/**
 * Two kinds of candidate:
 *
 *  1. a channel whose live type no longer matches the blueprint and that
 *     Discord cannot convert in place;
 *  2. a channel THIS BOT created that the blueprint no longer describes.
 *
 * The second is scoped deliberately narrowly: only channels recorded in
 * state.json under a key that has since disappeared. A channel someone else
 * made is never a candidate, no matter what it is called.
 */
async function findCandidates(guild: Guild): Promise<Candidate[]> {
  const convertible: ChannelType[] = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
  const candidates: Candidate[] = [];

  for (const { channel: definition } of allChannels()) {
    const live = findChannelAnyType(guild, definition.key);
    if (!live) continue;

    const wanted = DISCORD_TYPE[definition.type];
    if (live.type === wanted) continue;
    // Setup handles text ↔ announcement on its own; no deletion needed.
    if (convertible.includes(live.type) && convertible.includes(wanted)) continue;

    candidates.push({
      key: definition.key,
      channel: live,
      currentType: readableType(live.type),
      wantedType: definition.type,
      humanMessages: await countHumanMessages(live),
      reason: 'type change',
    });
  }

  const blueprintKeys = new Set(allChannels().map((entry) => entry.channel.key));
  for (const [key, channelId] of Object.entries(state.read().channels)) {
    if (blueprintKeys.has(key)) continue;

    const live = guild.channels.cache.get(channelId);
    if (!live) {
      // Already gone; just forget it.
      state.update((current) => {
        delete current.channels[key];
      });
      continue;
    }

    candidates.push({
      key,
      channel: live,
      currentType: readableType(live.type),
      wantedType: '— no longer in the blueprint',
      humanMessages: await countHumanMessages(live),
      reason: 'removed from blueprint',
    });
  }

  return candidates;
}

/**
 * How much would actually be lost. Bot-authored messages do not count: the
 * welcome and rules posts are republished by setup, so they are not a reason
 * to block a migration.
 */
async function countHumanMessages(channel: GuildBasedChannel): Promise<number> {
  const botId = channel.client.user?.id;

  if (!channel.isTextBased()) {
    // Forum and media channels hold posts rather than messages. The channel
    // guide is itself a post, authored by the bot — counting it as content
    // would block every migration for no reason, so posts the bot opened are
    // excluded.
    if ('threads' in channel) {
      const threads = await channel.threads.fetch().catch(() => null);
      if (!threads) return 0;
      return threads.threads.filter((thread) => thread.ownerId !== botId).size;
    }
    return 0;
  }

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return 0;
  return messages.filter((message) => !message.author.bot).size;
}

function readableType(type: ChannelType): string {
  const found = Object.entries(DISCORD_TYPE).find(([, value]) => value === type);
  return found ? found[0] : `type ${String(type)}`;
}

console.log(`THE DESK — channel type migration (${SERVER.categories.length} categories)`);

main().catch((error: unknown) => {
  console.error('\nMigration failed:');
  console.error(describeError(error));
  process.exitCode = 1;
});
