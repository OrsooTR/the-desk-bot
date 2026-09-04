import {
  AuditLogEvent,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildAuditLogsEntry,
} from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import { PROTECTION, thresholdFor, type ProtectedAction } from '../config/protection';
import { SERVER } from '../config/server';
import { describeError } from '../utils/errors';
import { logger } from './logger';
import { findRole, findTextChannel } from './resolve';

/* ────────────────────────────────────────────────────────────
 * Anti-nuke
 *
 * Counts destructive actions per executor in a rolling window and neutralises
 * anyone who crosses the line. The executor is read from the audit log,
 * because the gateway event for a deleted channel does not say who deleted it.
 *
 * Honest limits, stated up front:
 *
 *  - The guild owner cannot be stopped. Discord permits no action against
 *    them by anyone, including a bot with Administrator.
 *  - Anyone whose highest role sits above the bot cannot be stopped either.
 *  - Deleted channels and their messages are gone. Nothing can restore them.
 *    This limits the blast radius; it does not undo it.
 *
 * Which is why the real defence is upstream: one Administrator holder, the
 * bot's role kept high, and staff on 2FA.
 * ──────────────────────────────────────────────────────────── */

interface ActionRecord {
  at: number;
}

/** executorId → action → timestamps. In memory: a restart is a clean slate. */
const activity = new Map<string, Map<ProtectedAction, ActionRecord[]>>();

/** Executors already dealt with, so one attack produces one response. */
const handled = new Set<string>();

const AUDIT_LOOKUP: Record<ProtectedAction, AuditLogEvent> = {
  channelDelete: AuditLogEvent.ChannelDelete,
  channelCreate: AuditLogEvent.ChannelCreate,
  roleDelete: AuditLogEvent.RoleDelete,
  roleCreate: AuditLogEvent.RoleCreate,
  roleUpdate: AuditLogEvent.RoleUpdate,
  ban: AuditLogEvent.MemberBanAdd,
  kick: AuditLogEvent.MemberKick,
  webhookCreate: AuditLogEvent.WebhookCreate,
};

/**
 * Record one destructive action and respond if it crosses a threshold.
 * Called from the gateway event handlers.
 */
export async function noteAction(guild: Guild, action: ProtectedAction): Promise<void> {
  if (!PROTECTION.enabled) return;

  const executorId = await resolveExecutor(guild, action);
  if (!executorId) return;
  if (isExempt(guild, executorId)) return;

  const threshold = thresholdFor(action);
  if (!threshold) return;

  const perUser = activity.get(executorId) ?? new Map<ProtectedAction, ActionRecord[]>();
  const cutoff = Date.now() - threshold.windowSeconds * 1000;
  const recent = [...(perUser.get(action) ?? []), { at: Date.now() }].filter(
    (record) => record.at >= cutoff,
  );
  perUser.set(action, recent);
  activity.set(executorId, perUser);

  if (recent.length < threshold.limit) return;
  if (handled.has(executorId)) return;

  handled.add(executorId);
  await respond(guild, executorId, threshold.label, recent.length, threshold.windowSeconds);
}

/**
 * Who did it? The gateway does not say, so the audit log is consulted.
 * Only entries from the last few seconds are trusted — an older entry would
 * attribute this action to whoever last did something similar.
 */
async function resolveExecutor(guild: Guild, action: ProtectedAction): Promise<string | null> {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
    logger.warn(
      'PERMISSIONS',
      'Anti-nuke is blind: I need the View Audit Log permission to see who performed an action.',
      { discord: false },
    );
    return null;
  }

  try {
    const logs = await guild.fetchAuditLogs({ type: AUDIT_LOOKUP[action], limit: 1 });
    const entry: GuildAuditLogsEntry | undefined = logs.entries.first();
    if (!entry?.executor) return null;
    if (Date.now() - entry.createdTimestamp > 10_000) return null;
    if (entry.executor.id === guild.client.user?.id) return null;
    return entry.executor.id;
  } catch (error) {
    logger.error('ERROR', 'Could not read the audit log for anti-nuke', error);
    return null;
  }
}

function isExempt(guild: Guild, userId: string): boolean {
  if (userId === guild.ownerId) return true;
  if (userId === guild.client.user?.id) return true;
  return PROTECTION.exemptUserIds.includes(userId);
}

/** Strip the executor's roles (or ban them) and page the staff. */
async function respond(
  guild: Guild,
  executorId: string,
  label: string,
  count: number,
  windowSeconds: number,
): Promise<void> {
  const member = await guild.members.fetch(executorId).catch(() => null);
  const summary = `${count} ${label} in ${windowSeconds}s`;

  logger.error(
    'MODERATION',
    `ANTI-NUKE TRIGGERED — ${member?.user.tag ?? executorId}: ${summary}`,
  );

  let applied = 'no action taken';
  let problem: string | undefined;

  try {
    if (!member) {
      problem = 'The executor is no longer in the server.';
    } else if (PROTECTION.response === 'ban') {
      await member.ban({ reason: `Anti-nuke: ${summary}` });
      applied = 'banned';
    } else {
      // Quarantine rather than ban: the usual cause is a stolen session on a
      // trusted account, and a ban makes recovery harder than it needs to be.
      const removable = member.roles.cache.filter((role) => role.id !== guild.id && !role.managed);
      await member.roles.remove(removable, `Anti-nuke: ${summary}`);
      applied = `quarantined — ${removable.size} role(s) removed`;
    }
  } catch (error) {
    problem =
      'I could not act on them. They are almost certainly above me in the role list, or they are the server owner.';
    logger.error('MODERATION', `Anti-nuke response failed for ${executorId}`, error);
    console.error(describeError(error));
  }

  await alert(guild, executorId, summary, applied, problem);
}

async function alert(
  guild: Guild,
  executorId: string,
  summary: string,
  applied: string,
  problem?: string,
): Promise<void> {
  const channel = findTextChannel(guild, SERVER.moderationChannelKey);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle('ANTI-NUKE TRIGGERED')
    .setDescription(
      `<@${executorId}> exceeded a destructive-action threshold and was stopped automatically.`,
    )
    .addFields(
      { name: 'Detected', value: summary, inline: true },
      { name: 'Response', value: applied, inline: true },
      { name: 'User ID', value: `\`${executorId}\``, inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · verify this before restoring anything` })
    .setTimestamp(new Date());

  if (problem) embed.addFields({ name: 'Could not complete', value: problem });

  embed.addFields({
    name: 'What to do now',
    value: [
      '1. Confirm whether this was an attack or legitimate admin work.',
      '2. If it was an attack, assume the account is compromised — do not restore its roles.',
      '3. Deleted channels cannot be recovered. Run `/setup` to rebuild the structure.',
      '4. Check the audit log for anything this missed.',
    ].join('\n'),
  });

  const admin = PROTECTION.pingStaffOnAlert ? findRole(guild, 'admin') : null;

  await channel
    .send({
      ...(admin ? { content: `<@&${admin.id}>` } : {}),
      embeds: [embed],
      allowedMentions: admin ? { roles: [admin.id] } : { parse: [] },
    })
    .catch(() => logger.warn('MODERATION', 'Could not post the anti-nuke alert.'));
}

/** Clears the in-memory counters. Exposed for tests and manual recovery. */
export function resetProtectionState(): void {
  activity.clear();
  handled.clear();
}
