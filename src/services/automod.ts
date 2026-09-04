import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  PermissionFlagsBits,
  type AutoModerationRule,
  type Guild,
} from 'discord.js';
import {
  AUTOMOD_RULES,
  type AutoModPreset,
  type AutoModRuleDefinition,
} from '../config/moderation';
import { SERVER } from '../config/server';
import type { RoleKey } from '../types';
import { logger } from './logger';
import { findChannel, findRole, findTextChannel } from './resolve';

/* ────────────────────────────────────────────────────────────
 * AutoMod provisioning — the front-end filter
 *
 * These rules live on Discord's side. They evaluate a message before it is
 * delivered, which means a scam link is never seen by anybody, and the
 * protection does not stop when the bot does.
 *
 * Matched by name, created if missing, updated if drifted. Rules that exist
 * but are not in the blueprint are left alone — a moderator may have added
 * their own, and it is not this code's job to overrule them.
 *
 * Requires the Manage Server permission.
 * ──────────────────────────────────────────────────────────── */

export interface AutoModOutcome {
  name: string;
  status: 'created' | 'updated' | 'unchanged' | 'failed' | 'skipped';
  detail?: string;
}

/** Staff are exempt: a moderator quoting a scam to discuss it is not a scam. */
const EXEMPT_ROLES: RoleKey[] = ['moderator', 'admin', 'founder'];

export async function syncAutoMod(guild: Guild, dryRun: boolean): Promise<AutoModOutcome[]> {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return [
      {
        name: 'AutoMod',
        status: 'skipped',
        detail:
          'I need the Manage Server permission to create AutoMod rules. Grant it on my role and re-run.',
      },
    ];
  }

  const existing = await guild.autoModerationRules.fetch().catch(() => null);
  if (!existing) {
    return [{ name: 'AutoMod', status: 'failed', detail: 'Could not read the existing rules.' }];
  }

  const outcomes: AutoModOutcome[] = [];

  for (const definition of AUTOMOD_RULES) {
    // Preset rules are matched by trigger type, not by name: Discord permits
    // exactly one per server, so a rename must update the existing rule rather
    // than attempt a second one that can never be created.
    const live =
      (definition.kind === 'preset'
        ? existing.find(
            (rule) => rule.triggerType === AutoModerationRuleTriggerType.KeywordPreset,
          )
        : existing.find((rule) => rule.name === definition.name)) ?? null;

    outcomes.push(await syncRule(guild, definition, live, dryRun));
  }

  return outcomes;
}

async function syncRule(
  guild: Guild,
  definition: AutoModRuleDefinition,
  live: AutoModerationRule | null,
  dryRun: boolean,
): Promise<AutoModOutcome> {
  const payload = buildPayload(guild, definition);

  if (!live) {
    if (dryRun) return { name: definition.name, status: 'created', detail: 'would be created' };
    try {
      await guild.autoModerationRules.create({
        ...payload,
        reason: 'THE DESK moderation policy',
      });
      logger.info('PERMISSIONS', `Created AutoMod rule: ${definition.name}`);
      return { name: definition.name, status: 'created' };
    } catch (error) {
      logger.error('PERMISSIONS', `Could not create AutoMod rule ${definition.name}`, error);
      return { name: definition.name, status: 'failed', detail: 'creation rejected by Discord' };
    }
  }

  // Only re-write when something meaningful differs; AutoMod edits are not
  // free and a needless PATCH on every setup would be noise in the audit log.
  const drifted =
    !live.enabled ||
    live.name !== definition.name ||
    live.exemptRoles.size !== payload.exemptRoles.length;
  if (!drifted) return { name: definition.name, status: 'unchanged' };

  if (dryRun) return { name: definition.name, status: 'updated', detail: 'would be re-enabled' };

  try {
    await live.edit({ ...payload, reason: 'THE DESK moderation policy' });
    logger.info('PERMISSIONS', `Updated AutoMod rule: ${definition.name}`);
    return { name: definition.name, status: 'updated' };
  } catch (error) {
    logger.error('PERMISSIONS', `Could not update AutoMod rule ${definition.name}`, error);
    return { name: definition.name, status: 'failed', detail: 'update rejected by Discord' };
  }
}

function buildPayload(guild: Guild, definition: AutoModRuleDefinition) {
  const alertChannel = findTextChannel(guild, SERVER.moderationChannelKey);

  const actions = [
    {
      type: AutoModerationActionType.BlockMessage,
      metadata: { customMessage: definition.blockMessage.slice(0, 150) },
    },
    ...(alertChannel
      ? [
          {
            type: AutoModerationActionType.SendAlertMessage,
            metadata: { channel: alertChannel.id },
          },
        ]
      : []),
    // Discord rejects the timeout action on keyword-preset rules with a bare
    // "Action type 3 is not permitted". Dropping it here means a config edit
    // cannot silently break rule creation.
    ...(definition.timeoutSeconds && supportsTimeout(definition)
      ? [
          {
            type: AutoModerationActionType.Timeout,
            metadata: { durationSeconds: definition.timeoutSeconds },
          },
        ]
      : []),
  ];

  const exemptRoles = EXEMPT_ROLES.map((key) => findRole(guild, key)?.id).filter(
    (id): id is string => id !== undefined,
  );

  const exemptChannels = (definition.exemptChannelKeys ?? [])
    .map((key) => findChannel(guild, key)?.id)
    .filter((id): id is string => id !== undefined);

  return {
    name: definition.name,
    enabled: true,
    eventType: AutoModerationRuleEventType.MessageSend,
    ...triggerFor(definition),
    actions,
    exemptRoles,
    exemptChannels,
  };
}

/** Only these trigger types accept a Timeout action. */
function supportsTimeout(definition: AutoModRuleDefinition): boolean {
  return definition.kind === 'keyword' || definition.kind === 'spam' || definition.kind === 'mention-spam';
}

function triggerFor(definition: AutoModRuleDefinition) {
  switch (definition.kind) {
    case 'keyword':
      return {
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          keywordFilter: definition.keywords ?? [],
          regexPatterns: definition.regexPatterns ?? [],
          allowList: definition.allowList ?? [],
        },
      };
    case 'spam':
      return {
        triggerType: AutoModerationRuleTriggerType.Spam,
        triggerMetadata: {},
      };
    case 'mention-spam':
      return {
        triggerType: AutoModerationRuleTriggerType.MentionSpam,
        triggerMetadata: { mentionTotalLimit: definition.mentionLimit ?? 6 },
      };
    case 'preset':
      return {
        triggerType: AutoModerationRuleTriggerType.KeywordPreset,
        triggerMetadata: {
          presets: (definition.presets ?? []).map(presetType),
          allowList: definition.allowList ?? [],
        },
      };
  }
}

function presetType(preset: AutoModPreset): AutoModerationRuleKeywordPresetType {
  switch (preset) {
    case 'slurs':
      return AutoModerationRuleKeywordPresetType.Slurs;
    case 'sexual':
      return AutoModerationRuleKeywordPresetType.SexualContent;
    case 'profanity':
      return AutoModerationRuleKeywordPresetType.Profanity;
  }
}
