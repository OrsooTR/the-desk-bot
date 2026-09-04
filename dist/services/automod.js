"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAutoMod = syncAutoMod;
const discord_js_1 = require("discord.js");
const moderation_1 = require("../config/moderation");
const server_1 = require("../config/server");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
/** Staff are exempt: a moderator quoting a scam to discuss it is not a scam. */
const EXEMPT_ROLES = ['moderator', 'admin', 'founder'];
async function syncAutoMod(guild, dryRun) {
    const me = guild.members.me;
    if (!me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild)) {
        return [
            {
                name: 'AutoMod',
                status: 'skipped',
                detail: 'I need the Manage Server permission to create AutoMod rules. Grant it on my role and re-run.',
            },
        ];
    }
    const existing = await guild.autoModerationRules.fetch().catch(() => null);
    if (!existing) {
        return [{ name: 'AutoMod', status: 'failed', detail: 'Could not read the existing rules.' }];
    }
    const outcomes = [];
    for (const definition of moderation_1.AUTOMOD_RULES) {
        // Preset rules are matched by trigger type, not by name: Discord permits
        // exactly one per server, so a rename must update the existing rule rather
        // than attempt a second one that can never be created.
        const live = (definition.kind === 'preset'
            ? existing.find((rule) => rule.triggerType === discord_js_1.AutoModerationRuleTriggerType.KeywordPreset)
            : existing.find((rule) => rule.name === definition.name)) ?? null;
        outcomes.push(await syncRule(guild, definition, live, dryRun));
    }
    return outcomes;
}
async function syncRule(guild, definition, live, dryRun) {
    const payload = buildPayload(guild, definition);
    if (!live) {
        if (dryRun)
            return { name: definition.name, status: 'created', detail: 'would be created' };
        try {
            await guild.autoModerationRules.create({
                ...payload,
                reason: 'THE DESK moderation policy',
            });
            logger_1.logger.info('PERMISSIONS', `Created AutoMod rule: ${definition.name}`);
            return { name: definition.name, status: 'created' };
        }
        catch (error) {
            logger_1.logger.error('PERMISSIONS', `Could not create AutoMod rule ${definition.name}`, error);
            return { name: definition.name, status: 'failed', detail: 'creation rejected by Discord' };
        }
    }
    // Only re-write when something meaningful differs; AutoMod edits are not
    // free and a needless PATCH on every setup would be noise in the audit log.
    const drifted = !live.enabled ||
        live.name !== definition.name ||
        live.exemptRoles.size !== payload.exemptRoles.length;
    if (!drifted)
        return { name: definition.name, status: 'unchanged' };
    if (dryRun)
        return { name: definition.name, status: 'updated', detail: 'would be re-enabled' };
    try {
        await live.edit({ ...payload, reason: 'THE DESK moderation policy' });
        logger_1.logger.info('PERMISSIONS', `Updated AutoMod rule: ${definition.name}`);
        return { name: definition.name, status: 'updated' };
    }
    catch (error) {
        logger_1.logger.error('PERMISSIONS', `Could not update AutoMod rule ${definition.name}`, error);
        return { name: definition.name, status: 'failed', detail: 'update rejected by Discord' };
    }
}
function buildPayload(guild, definition) {
    const alertChannel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.moderationChannelKey);
    const actions = [
        {
            type: discord_js_1.AutoModerationActionType.BlockMessage,
            metadata: { customMessage: definition.blockMessage.slice(0, 150) },
        },
        ...(alertChannel
            ? [
                {
                    type: discord_js_1.AutoModerationActionType.SendAlertMessage,
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
                    type: discord_js_1.AutoModerationActionType.Timeout,
                    metadata: { durationSeconds: definition.timeoutSeconds },
                },
            ]
            : []),
    ];
    const exemptRoles = EXEMPT_ROLES.map((key) => (0, resolve_1.findRole)(guild, key)?.id).filter((id) => id !== undefined);
    const exemptChannels = (definition.exemptChannelKeys ?? [])
        .map((key) => (0, resolve_1.findChannel)(guild, key)?.id)
        .filter((id) => id !== undefined);
    return {
        name: definition.name,
        enabled: true,
        eventType: discord_js_1.AutoModerationRuleEventType.MessageSend,
        ...triggerFor(definition),
        actions,
        exemptRoles,
        exemptChannels,
    };
}
/** Only these trigger types accept a Timeout action. */
function supportsTimeout(definition) {
    return definition.kind === 'keyword' || definition.kind === 'spam' || definition.kind === 'mention-spam';
}
function triggerFor(definition) {
    switch (definition.kind) {
        case 'keyword':
            return {
                triggerType: discord_js_1.AutoModerationRuleTriggerType.Keyword,
                triggerMetadata: {
                    keywordFilter: definition.keywords ?? [],
                    regexPatterns: definition.regexPatterns ?? [],
                    allowList: definition.allowList ?? [],
                },
            };
        case 'spam':
            return {
                triggerType: discord_js_1.AutoModerationRuleTriggerType.Spam,
                triggerMetadata: {},
            };
        case 'mention-spam':
            return {
                triggerType: discord_js_1.AutoModerationRuleTriggerType.MentionSpam,
                triggerMetadata: { mentionTotalLimit: definition.mentionLimit ?? 6 },
            };
        case 'preset':
            return {
                triggerType: discord_js_1.AutoModerationRuleTriggerType.KeywordPreset,
                triggerMetadata: {
                    presets: (definition.presets ?? []).map(presetType),
                    allowList: definition.allowList ?? [],
                },
            };
    }
}
function presetType(preset) {
    switch (preset) {
        case 'slurs':
            return discord_js_1.AutoModerationRuleKeywordPresetType.Slurs;
        case 'sexual':
            return discord_js_1.AutoModerationRuleKeywordPresetType.SexualContent;
        case 'profanity':
            return discord_js_1.AutoModerationRuleKeywordPresetType.Profanity;
    }
}
//# sourceMappingURL=automod.js.map