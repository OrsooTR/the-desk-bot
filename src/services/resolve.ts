import {
  ChannelType,
  type CategoryChannel,
  type ForumChannel,
  type Guild,
  type GuildBasedChannel,
  type MediaChannel,
  type NewsChannel,
  type Role,
  type StageChannel,
  type TextChannel,
  type VoiceChannel,
} from 'discord.js';
import type { ManagedChannelType, RoleKey } from '../types';
import { SERVER, allChannels, roleDef } from '../config/server';
import { state } from './state';

/* ────────────────────────────────────────────────────────────
 * Resource resolution
 *
 * Every lookup follows the same two-step rule:
 *   1. the snowflake we remembered in state.json  (survives renames)
 *   2. an exact, case-insensitive name match      (survives a lost state file)
 *
 * When step 2 succeeds we re-write state, so the server heals itself instead
 * of drifting. When both fail, the resource is genuinely missing and /setup
 * will create it.
 * ──────────────────────────────────────────────────────────── */

/** Accepts core role keys and self-assignable ones alike. */
export function findRole(guild: Guild, key: RoleKey | string): Role | null {
  const definition = roleDef(key);
  if (!definition) return null;

  const remembered = state.roleId(key);
  if (remembered) {
    const byId = guild.roles.cache.get(remembered);
    if (byId) return byId;
  }

  const name = definition.name.toLowerCase();
  const byName = guild.roles.cache.find((role) => role.name.toLowerCase() === name) ?? null;
  if (byName && byName.id !== remembered) state.rememberRole(key, byName.id);
  return byName;
}

export function findCategory(guild: Guild, key: string): CategoryChannel | null {
  const definition = SERVER.categories.find((category) => category.key === key);
  if (!definition) return null;

  const remembered = state.categoryId(key);
  if (remembered) {
    const byId = guild.channels.cache.get(remembered);
    if (byId?.type === ChannelType.GuildCategory) return byId;
  }

  const name = definition.name.toLowerCase();
  const byName =
    guild.channels.cache.find(
      (channel): channel is CategoryChannel =>
        channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === name,
    ) ?? null;

  if (byName && byName.id !== remembered) state.rememberCategory(key, byName.id);
  return byName;
}

/** Discord's numeric type for each blueprint channel type. */
export type ManagedDiscordType =
  | ChannelType.GuildText
  | ChannelType.GuildAnnouncement
  | ChannelType.GuildForum
  | ChannelType.GuildMedia
  | ChannelType.GuildVoice
  | ChannelType.GuildStageVoice;

export const DISCORD_TYPE: Record<ManagedChannelType, ManagedDiscordType> = {
  text: ChannelType.GuildText,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  media: ChannelType.GuildMedia,
  voice: ChannelType.GuildVoice,
  stage: ChannelType.GuildStageVoice,
};

/** Every channel class the blueprint provisions. */
export type ManagedChannel =
  | TextChannel
  | NewsChannel
  | ForumChannel
  | MediaChannel
  | VoiceChannel
  | StageChannel;

const MANAGED_TYPES = new Set<ChannelType>(Object.values(DISCORD_TYPE));

function isManaged(
  channel: GuildBasedChannel | null | undefined,
  wanted: ManagedDiscordType,
): channel is ManagedChannel {
  return !!channel && channel.type === wanted && MANAGED_TYPES.has(channel.type);
}

/**
 * Find a channel by key regardless of its current type.
 *
 * Used when the blueprint's type no longer matches what is live — the type
 * migration needs to see the channel that is actually there in order to
 * report it, rather than concluding it is missing and creating a duplicate.
 */
export function findChannelAnyType(guild: Guild, key: string): GuildBasedChannel | null {
  const entry = allChannels().find((candidate) => candidate.channel.key === key);
  if (!entry) return null;

  const remembered = state.channelId(key);
  if (remembered) {
    const byId = guild.channels.cache.get(remembered);
    if (byId) return byId;
  }

  const name = entry.channel.name.toLowerCase();
  return guild.channels.cache.find((channel) => channel.name.toLowerCase() === name) ?? null;
}

export function findChannel(guild: Guild, key: string): ManagedChannel | null {
  const entry = allChannels().find((candidate) => candidate.channel.key === key);
  if (!entry) return null;

  const wantedType = DISCORD_TYPE[entry.channel.type];

  const remembered = state.channelId(key);
  if (remembered) {
    const byId = guild.channels.cache.get(remembered);
    if (isManaged(byId, wantedType)) return byId;
  }

  // Scope the name match to the owning category where we know it, so a
  // manually created `#general` elsewhere is never mistaken for ours.
  const parent = findCategory(guild, entry.category.key);
  const name = entry.channel.name.toLowerCase();
  const candidates = [...guild.channels.cache.values()].filter(
    (channel): channel is ManagedChannel =>
      isManaged(channel, wantedType) && channel.name.toLowerCase() === name,
  );

  const byName =
    candidates.find((channel) => parent && channel.parentId === parent.id) ??
    candidates[0] ??
    null;

  if (byName && byName.id !== remembered) state.rememberChannel(key, byName.id);
  return byName;
}

/**
 * A channel the bot can post a normal message into. Announcement channels
 * behave like text channels for sending, which is why #events qualifies.
 */
export type PostableChannel = TextChannel | NewsChannel;

export function findTextChannel(guild: Guild, key: string): PostableChannel | null {
  const channel = findChannel(guild, key);
  if (channel?.type === ChannelType.GuildText) return channel;
  if (channel?.type === ChannelType.GuildAnnouncement) return channel;
  return null;
}

export function findVoiceChannel(guild: Guild, key: string): VoiceChannel | null {
  const channel = findChannel(guild, key);
  return channel?.type === ChannelType.GuildVoice ? channel : null;
}

/** Voice or stage — the two places a scheduled session can actually happen. */
export function findSessionChannel(
  guild: Guild,
  key: string,
): VoiceChannel | StageChannel | null {
  const channel = findChannel(guild, key);
  if (channel?.type === ChannelType.GuildVoice) return channel;
  if (channel?.type === ChannelType.GuildStageVoice) return channel;
  return null;
}

/** The channel bot output is mirrored into, or null if setup has not run yet. */
export function findLogChannel(guild: Guild): PostableChannel | null {
  return findTextChannel(guild, SERVER.logChannelKey);
}
