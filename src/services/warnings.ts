import type { Guild, GuildMember, User } from 'discord.js';
import {
  STRIKE_DECAY_DAYS,
  findOffence,
  resolveLadder,
  type LadderStep,
  type OffenceDefinition,
} from '../config/moderation';
import { OperationalError } from '../utils/errors';
import { logger } from './logger';
import { recordModeration } from './moderationLog';
import { state } from './state';

/* ────────────────────────────────────────────────────────────
 * Strikes
 *
 * A warning is a record, not a mood. Filing one adds points; the ladder in
 * config/moderation.ts turns the running total into a consequence. The
 * moderator chooses the offence, never the punishment — that is the whole
 * point, so that the same behaviour costs the same regardless of who is on
 * duty or how annoyed they are.
 * ──────────────────────────────────────────────────────────── */

export interface StrikeRecord {
  offenceKey: string;
  points: number;
  reason: string;
  moderatorId: string;
  at: string;
  /** Set when the strike was filed automatically rather than by a person. */
  automatic?: boolean;
}

export interface WarnOutcome {
  offence: OffenceDefinition;
  activePoints: number;
  step: LadderStep | null;
  /** What was actually carried out. */
  applied: string;
  /** Present when the consequence could not be carried out. */
  problem?: string;
}

function decayCutoff(): number {
  return Date.now() - STRIKE_DECAY_DAYS * 24 * 60 * 60 * 1000;
}

/** Strikes still inside the decay window, newest first. */
export function activeStrikes(userId: string): StrikeRecord[] {
  const cutoff = decayCutoff();
  return (state.read().strikes[userId] ?? [])
    .filter((strike) => Date.parse(strike.at) >= cutoff)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function activePoints(userId: string): number {
  return activeStrikes(userId).reduce((total, strike) => total + strike.points, 0);
}

/** Every strike ever filed, including expired ones. Used by /warnings. */
export function allStrikes(userId: string): StrikeRecord[] {
  return [...(state.read().strikes[userId] ?? [])].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );
}

export function clearStrikes(userId: string): number {
  const existing = state.read().strikes[userId]?.length ?? 0;
  state.update((current) => {
    delete current.strikes[userId];
  });
  return existing;
}

/**
 * File a strike and carry out whatever the ladder says.
 *
 * The record is written before the consequence is attempted: if the timeout
 * fails because the member outranks the bot, the strike must still stand.
 */
export async function fileStrike(
  guild: Guild,
  target: GuildMember,
  moderator: User,
  offenceKey: string,
  reason: string,
  automatic = false,
): Promise<WarnOutcome> {
  const offence = findOffence(offenceKey);
  if (!offence) throw new OperationalError(`Unknown offence type: ${offenceKey}`);

  const record: StrikeRecord = {
    offenceKey: offence.key,
    points: offence.points,
    reason,
    moderatorId: moderator.id,
    at: new Date().toISOString(),
    ...(automatic ? { automatic: true } : {}),
  };

  state.update((current) => {
    current.strikes[target.id] = [...(current.strikes[target.id] ?? []), record];
  });

  const points = activePoints(target.id);
  const step = offence.immediate ? null : resolveLadder(points);

  const outcome: WarnOutcome = {
    offence,
    activePoints: points,
    step,
    applied: 'Warning recorded',
  };

  await notify(target, guild.name, offence, reason, points);

  try {
    if (offence.immediate === 'ban') {
      await guild.members.ban(target.id, {
        reason: `${offence.label}: ${reason} — filed by ${moderator.tag}`,
      });
      outcome.applied = 'Banned immediately';
    } else if (offence.immediate === 'kick') {
      await target.kick(`${offence.label}: ${reason} — filed by ${moderator.tag}`);
      outcome.applied = 'Removed from the server';
    } else if (step?.action.type === 'ban') {
      await guild.members.ban(target.id, { reason: `Strike ladder: ${reason}` });
      outcome.applied = step.summary;
    } else if (step?.action.type === 'kick') {
      await target.kick(`Strike ladder: ${reason}`);
      outcome.applied = step.summary;
    } else if (step?.action.type === 'timeout') {
      await target.timeout(step.action.minutes * 60_000, `Strike ladder: ${reason}`);
      outcome.applied = step.summary;
    } else if (step) {
      outcome.applied = step.summary;
    }
  } catch (error) {
    outcome.problem =
      'The strike was recorded, but I could not carry out the consequence — the member is probably above me in the role list.';
    logger.error('MODERATION', `Could not apply the ladder to ${target.user.tag}`, error);
  }

  await recordModeration(guild, {
    action: 'WARN',
    moderator,
    target: target.user,
    reason: `${offence.label} — ${reason}`,
    detail: `${offence.points} pt · total ${points} · ${outcome.applied}${automatic ? ' · automatic' : ''}`,
  });

  return outcome;
}

/** Tell the member what happened. A silent punishment teaches nothing. */
async function notify(
  target: GuildMember,
  guildName: string,
  offence: OffenceDefinition,
  reason: string,
  points: number,
): Promise<void> {
  const lines = [
    `You have received a warning in **${guildName}**.`,
    '',
    `**Offence:** ${offence.label}`,
    `**Reason:** ${reason}`,
    `**Points:** ${offence.points} (active total: ${points})`,
    '',
    offence.immediate
      ? 'This category does not carry a warning ladder.'
      : `Points expire after ${STRIKE_DECAY_DAYS} days. At 2 points you are timed out for an hour, at 7 you are banned.`,
    '',
    'If you believe this is wrong, open a ticket rather than arguing in the channel.',
  ];

  // A member with DMs closed must not block moderation.
  await target.send(lines.join('\n')).catch(() => undefined);
}
