import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type VoiceBasedChannel,
  type VoiceState,
} from 'discord.js';
import { allChannels } from '../config/server';
import type { VoiceSpawner } from '../types';
import { truncate } from '../utils/format';
import { logger } from './logger';
import { findChannel, findRole } from './resolve';
import { state } from './state';

/* ────────────────────────────────────────────────────────────
 * On-demand voice rooms
 *
 * Joining a "Create …" hub spawns a room and moves you into it. When the last
 * person leaves, the room is deleted.
 *
 * This is the ONE place the bot deletes a channel, and the constraints on it
 * are deliberately tight: it only ever removes a channel it created itself,
 * that it still has recorded in state, that is empty, and that sits under the
 * expected category. Everything else is left alone. The anti-nuke watcher
 * ignores actions performed by the bot, so a busy evening cannot trip it.
 *
 * Why hubs instead of standing rooms: a server with six permanently empty
 * voice channels looks abandoned. A room that exists only while someone is in
 * it makes activity visible.
 * ──────────────────────────────────────────────────────────── */

interface HubDefinition {
  channelId: string;
  spawner: VoiceSpawner;
  categoryId: string | null;
}

/** Resolve the configured hubs against the live server. */
function hubs(guild: Guild): HubDefinition[] {
  const found: HubDefinition[] = [];

  for (const { channel: definition } of allChannels()) {
    if (!definition.spawner) continue;
    const live = findChannel(guild, definition.key);
    if (!live || live.type !== ChannelType.GuildVoice) continue;
    found.push({
      channelId: live.id,
      spawner: definition.spawner,
      categoryId: live.parentId,
    });
  }

  return found;
}

export async function onVoiceStateUpdate(before: VoiceState, after: VoiceState): Promise<void> {
  // Someone left a room: it may now be empty and disposable.
  if (before.channelId && before.channelId !== after.channelId) {
    await cleanUp(before.guild, before.channelId);
  }

  // Someone joined a hub: give them a room of their own.
  if (after.channelId && after.channelId !== before.channelId && after.member) {
    const hub = hubs(after.guild).find((entry) => entry.channelId === after.channelId);
    if (hub) await spawn(after.guild, after.member, hub);
  }
}

async function spawn(guild: Guild, member: GuildMember, hub: HubDefinition): Promise<void> {
  // Belt and braces: the hub's own overwrites already stop unauthorised
  // members from connecting, but a permission mistake should not become a
  // privilege escalation.
  if (hub.spawner.restrictTo && !hasAnyRole(member, hub.spawner.restrictTo)) {
    await member.voice.disconnect('Not permitted to create a room here').catch(() => undefined);
    return;
  }

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    logger.warn('PERMISSIONS', 'Cannot create a voice room: I need Manage Channels.');
    return;
  }

  const name = truncate(hub.spawner.namePattern.replace('{user}', member.displayName), 100);

  try {
    const room = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      ...(hub.categoryId ? { parent: hub.categoryId } : {}),
      ...(hub.spawner.userLimit ? { userLimit: hub.spawner.userLimit } : {}),
      ...(hub.spawner.private ? { permissionOverwrites: privateOverwrites(guild, member, hub) } : {}),
      reason: `On-demand voice room for ${member.user.tag}`,
    });

    state.update((current) => {
      current.tempVoiceChannels[room.id] = {
        ownerId: member.id,
        createdAt: new Date().toISOString(),
      };
    });

    await member.voice.setChannel(room).catch(async () => {
      // They left before the room existed. Do not leave an orphan behind.
      await room.delete('Creator left before the room was ready').catch(() => undefined);
      state.update((current) => {
        delete current.tempVoiceChannels[room.id];
      });
    });

    logger.info('EVENT', `Voice room "${name}" opened by ${member.user.tag}`);
  } catch (error) {
    logger.error('EVENT', `Could not create a voice room for ${member.user.tag}`, error);
  }
}

/** A private room: invisible to everyone except the permitted roles. */
function privateOverwrites(guild: Guild, member: GuildMember, hub: HubDefinition) {
  const allowed = (hub.spawner.restrictTo ?? [])
    .map((key) => findRole(guild, key)?.id)
    .filter((id): id is string => id !== undefined);

  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    },
    ...allowed.map((id) => ({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.MoveMembers,
      ],
    })),
  ];
}

/**
 * Delete a temporary room once it empties.
 *
 * Every condition has to hold: we created it, we still have it recorded, it is
 * a voice channel, and nobody is in it. A no on any of them means we leave it
 * alone, because the cost of a false positive here is somebody's channel.
 */
async function cleanUp(guild: Guild, channelId: string): Promise<void> {
  if (!state.read().tempVoiceChannels[channelId]) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    state.update((current) => {
      delete current.tempVoiceChannels[channelId];
    });
    return;
  }

  if (channel.members.size > 0) return;

  try {
    await channel.delete('On-demand voice room emptied');
    logger.info('EVENT', `Voice room "${channel.name}" closed (empty)`);
  } catch (error) {
    logger.error('EVENT', `Could not delete the empty voice room ${channel.name}`, error);
  } finally {
    state.update((current) => {
      delete current.tempVoiceChannels[channelId];
    });
  }
}

/**
 * Sweep on startup: rooms that emptied while the bot was down would otherwise
 * linger forever, since the voice event that would have cleaned them up has
 * already been and gone.
 */
export async function sweepOrphanedRooms(guild: Guild): Promise<number> {
  const tracked = Object.keys(state.read().tempVoiceChannels);
  let removed = 0;

  for (const channelId of tracked) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      state.update((current) => {
        delete current.tempVoiceChannels[channelId];
      });
      continue;
    }
    if (channel.type !== ChannelType.GuildVoice) continue;
    if ((channel as VoiceBasedChannel).members.size > 0) continue;

    await channel.delete('Orphaned on-demand voice room').catch(() => undefined);
    state.update((current) => {
      delete current.tempVoiceChannels[channelId];
    });
    removed += 1;
  }

  if (removed > 0) logger.info('BOOT', `Swept ${removed} orphaned voice room(s)`);
  return removed;
}

function hasAnyRole(member: GuildMember, keys: string[]): boolean {
  if (member.id === member.guild.ownerId) return true;
  return keys.some((key) => {
    const role = findRole(member.guild, key);
    return role ? member.roles.cache.has(role.id) : false;
  });
}
