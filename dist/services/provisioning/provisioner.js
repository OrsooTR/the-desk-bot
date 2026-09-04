"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncServer = syncServer;
exports.managedChannelIds = managedChannelIds;
const discord_js_1 = require("discord.js");
const server_1 = require("../../config/server");
const overwrites_1 = require("../../permissions/overwrites");
const errors_1 = require("../../utils/errors");
const logger_1 = require("../logger");
const resolve_1 = require("../resolve");
const state_1 = require("../state");
/* ────────────────────────────────────────────────────────────
 * The provisioner
 *
 * One code path serves both /setup and /setup-dry-run. `options.dryRun`
 * suppresses every write, and nothing else changes — which is the only way a
 * dry run can be trusted to describe the real run.
 *
 * Guarantees:
 *  - Nothing is ever deleted. Not channels, not roles, not messages.
 *  - Resources are matched by remembered ID first, then by name, so renames
 *    and a lost state file both resolve to the existing resource rather than
 *    producing a duplicate.
 *  - Overwrites for targets we do not manage are preserved on write.
 *  - A failure on one resource is recorded and the sync continues.
 * ──────────────────────────────────────────────────────────── */
const AUDIT_PREFIX = 'THE DESK setup';
async function syncServer(guild, options) {
    const startedAt = Date.now();
    const report = {
        dryRun: options.dryRun,
        guildName: guild.name,
        outcomes: [],
        notes: [],
        warnings: [],
        unmanagedChannels: [],
        durationMs: 0,
    };
    const reason = `${AUDIT_PREFIX}${options.actorTag ? ` (by ${options.actorTag})` : ''}`;
    // Work from fresh data: a cached view can hide a channel someone deleted
    // thirty seconds ago, which is exactly the case setup exists to repair.
    await guild.roles.fetch();
    await guild.channels.fetch();
    const botMember = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!botMember) {
        report.warnings.push('Could not resolve my own membership in this server.');
        report.durationMs = Date.now() - startedAt;
        return report;
    }
    preflight(botMember.permissions, report);
    checkCommunityFeatures(guild, report);
    await syncEveryoneRole(guild, report, options, reason);
    await syncRoles(guild, report, options, reason);
    await syncRolePositions(guild, report, options);
    checkAssignableRoles(guild, report);
    await syncCategoriesAndChannels(guild, botMember.id, report, options, reason);
    collectUnmanaged(guild, report);
    report.durationMs = Date.now() - startedAt;
    return report;
}
/* ── Preflight ─────────────────────────────────────────────── */
function preflight(permissions, report) {
    const required = [
        ['Manage Roles', discord_js_1.PermissionFlagsBits.ManageRoles],
        ['Manage Channels', discord_js_1.PermissionFlagsBits.ManageChannels],
    ];
    for (const [label, flag] of required) {
        if (!permissions.has(flag)) {
            report.warnings.push(`I am missing the **${label}** permission. Anything requiring it will be reported as failed.`);
        }
    }
}
/** Channel types Discord only allows in a Community-enabled server. */
const COMMUNITY_ONLY_TYPES = ['announcement', 'stage', 'media'];
/**
 * Discord gates several channel types behind Community mode, and refuses to
 * create them with a bare "Cannot execute action on this channel type"
 * (error 50024) that says nothing about the actual cause. Detecting it up
 * front turns an inscrutable API error into an instruction.
 *
 * Forum channels are NOT gated — they work in any server.
 */
function checkCommunityFeatures(guild, report) {
    if (guild.features.includes('COMMUNITY'))
        return;
    const gated = (0, server_1.allChannels)().filter(({ channel }) => COMMUNITY_ONLY_TYPES.includes(channel.type));
    if (gated.length === 0)
        return;
    report.warnings.push(`This server is not enabled as a Community, so Discord will reject ${gated
        .map(({ channel }) => `${channel.name} (${channel.type})`)
        .join(', ')}. ` +
        'Fix: Server Settings → Enable Community, then re-run setup. Forum channels are unaffected.');
}
/* ── @everyone ─────────────────────────────────────────────── */
async function syncEveryoneRole(guild, report, options, reason) {
    const everyone = guild.roles.everyone;
    const desired = new discord_js_1.PermissionsBitField(server_1.SERVER.everyonePermissions).bitfield;
    if (everyone.permissions.bitfield === desired) {
        report.outcomes.push(base('role', '@everyone', '@everyone', 'unchanged'));
        return;
    }
    const outcome = base('role', '@everyone', '@everyone', 'updated', [
        'baseline permissions differ from the blueprint',
    ]);
    if (!options.dryRun) {
        try {
            await everyone.setPermissions(desired, reason);
            logger_1.logger.info('SETUP', 'Updated @everyone baseline permissions');
        }
        catch (error) {
            fail(outcome, error, 'update @everyone permissions');
        }
    }
    report.outcomes.push(outcome);
}
/* ── Roles ─────────────────────────────────────────────────── */
async function syncRoles(guild, report, options, reason) {
    // Core roles first, then the cosmetic self-assignable ones. Order matters:
    // roles are created at the bottom of the list, so creating the hierarchy
    // roles first keeps the self-assign roles beneath them.
    for (const definition of [...server_1.SERVER.roles, ...server_1.SERVER.selfRoles]) {
        const existing = (0, resolve_1.findRole)(guild, definition.key);
        if (!existing) {
            const outcome = base('role', definition.key, `@${definition.name}`, 'created');
            if (!options.dryRun) {
                try {
                    const created = await guild.roles.create({
                        name: definition.name,
                        permissions: new discord_js_1.PermissionsBitField(definition.permissions),
                        hoist: definition.hoist,
                        mentionable: definition.mentionable,
                        ...(definition.color === undefined
                            ? {}
                            : { colors: { primaryColor: definition.color } }),
                        reason,
                    });
                    state_1.state.rememberRole(definition.key, created.id);
                    logger_1.logger.info('SETUP', `Created role: @${definition.name}`);
                }
                catch (error) {
                    fail(outcome, error, `create the role @${definition.name}`);
                }
            }
            report.outcomes.push(outcome);
            continue;
        }
        if (existing.managed) {
            // Integration roles belong to Discord; editing them always fails.
            report.warnings.push(`@${existing.name} is managed by an integration and was left untouched.`);
            report.outcomes.push(base('role', definition.key, `@${definition.name}`, 'unchanged'));
            continue;
        }
        const reasons = diffRole(existing, definition);
        if (reasons.length === 0) {
            report.outcomes.push(base('role', definition.key, `@${definition.name}`, 'unchanged'));
            continue;
        }
        const outcome = base('role', definition.key, `@${definition.name}`, 'updated', reasons);
        if (!options.dryRun) {
            try {
                await existing.edit({
                    name: definition.name,
                    permissions: new discord_js_1.PermissionsBitField(definition.permissions),
                    hoist: definition.hoist,
                    mentionable: definition.mentionable,
                    // Gradients are cleared deliberately: the palette is meant to stay
                    // flat and muted, not become a two-tone badge.
                    colors: {
                        primaryColor: definition.color ?? 0,
                        secondaryColor: null,
                        tertiaryColor: null,
                    },
                    reason,
                });
                state_1.state.rememberRole(definition.key, existing.id);
                logger_1.logger.info('SETUP', `Updated role: @${definition.name} (${reasons.join(', ')})`);
            }
            catch (error) {
                fail(outcome, error, `update the role @${definition.name}`);
            }
        }
        report.outcomes.push(outcome);
    }
}
function diffRole(role, definition) {
    const reasons = [];
    if (role.name !== definition.name)
        reasons.push(`name (${role.name} → ${definition.name})`);
    if (role.permissions.bitfield !== new discord_js_1.PermissionsBitField(definition.permissions).bitfield)
        reasons.push('permissions');
    if (role.hoist !== definition.hoist)
        reasons.push('hoist');
    if (role.mentionable !== definition.mentionable)
        reasons.push('mentionable');
    if (role.colors.primaryColor !== (definition.color ?? 0) ||
        role.colors.secondaryColor !== null ||
        role.colors.tertiaryColor !== null) {
        reasons.push('colour');
    }
    return reasons;
}
/**
 * Reorder the managed roles among themselves.
 *
 * Only the slots our own roles already occupy are permuted, so roles belonging
 * to other bots or integrations keep their relative place. If the bot's own
 * role sits too low to move them, this is a warning — never a hard failure.
 */
async function syncRolePositions(guild, report, options) {
    const managed = server_1.SERVER.roles
        .map((definition) => (0, resolve_1.findRole)(guild, definition.key))
        .filter((role) => role !== null && !role.managed);
    if (managed.length < 2)
        return;
    // Highest slot to the highest-ranked blueprint role.
    const slots = managed.map((role) => role.position).sort((a, b) => b - a);
    const assignments = managed.map((role, index) => ({ role, position: slots[index] }));
    const drifted = assignments.filter(({ role, position }) => role.position !== position);
    if (drifted.length === 0)
        return;
    if (options.dryRun) {
        report.notes.push(`Role order would be corrected for: ${drifted.map(({ role }) => `@${role.name}`).join(', ')}.`);
        return;
    }
    try {
        await guild.roles.setPositions(assignments.map(({ role, position }) => ({ role, position })));
        report.notes.push('Role hierarchy reordered to match the blueprint.');
        logger_1.logger.info('SETUP', 'Reordered roles to match the blueprint hierarchy');
    }
    catch (error) {
        report.warnings.push('Could not reorder roles — my own role is probably below them. Drag the bot role higher and re-run.');
        logger_1.logger.warn('SETUP', 'Role reorder failed', { detail: (0, errors_1.describeError)(error) });
    }
}
/**
 * Can the bot actually hand out the roles the onboarding flow depends on?
 *
 * Reordering can succeed while still leaving the bot beneath the roles it has
 * to assign — the permutation only shuffles the slots those roles already
 * occupy. That looks fine in the report and then fails silently at the moment
 * a real person joins, which is the worst possible time to find out.
 */
function checkAssignableRoles(guild, report) {
    const me = guild.members.me;
    if (!me)
        return;
    const mine = me.roles.highest;
    const blocked = [server_1.SERVER.joinRole, server_1.SERVER.verifiedRole]
        .map((key) => (0, resolve_1.findRole)(guild, key))
        .filter((role) => role !== null && role.position >= mine.position);
    if (blocked.length === 0)
        return;
    report.warnings.push(`My highest role (@${mine.name}) is not above ${blocked
        .map((role) => `@${role.name}`)
        .join(' and ')}. I cannot assign ${blocked.length === 1 ? 'that role' : 'those roles'}, ` +
        'so joining and verification will fail. Fix: Server Settings → Roles, drag my role higher.');
}
/* ── Categories and channels ───────────────────────────────── */
async function syncCategoriesAndChannels(guild, botId, report, options, reason) {
    for (const [index, definition] of server_1.SERVER.categories.entries()) {
        const category = await syncCategory(guild, botId, definition, index, report, options, reason);
        for (const [channelIndex, channelDefinition] of definition.channels.entries()) {
            await syncChannel(guild, botId, definition, channelDefinition, category, channelIndex, report, options, reason);
        }
    }
}
async function syncCategory(guild, botId, definition, index, report, options, reason) {
    const existing = (0, resolve_1.findCategory)(guild, definition.key);
    const { overwrites, missing } = (0, overwrites_1.resolveOverwrites)(guild, definition.overwrites, botId);
    if (!existing) {
        const outcome = base('category', definition.key, definition.name, 'created');
        if (options.dryRun) {
            report.outcomes.push(outcome);
            return null;
        }
        try {
            const created = await guild.channels.create({
                name: definition.name,
                type: discord_js_1.ChannelType.GuildCategory,
                position: index,
                permissionOverwrites: overwrites,
                reason,
            });
            state_1.state.rememberCategory(definition.key, created.id);
            logger_1.logger.info('SETUP', `Created category: ${definition.name}`);
            report.outcomes.push(outcome);
            return created;
        }
        catch (error) {
            fail(outcome, error, `create the category ${definition.name}`);
            report.outcomes.push(outcome);
            return null;
        }
    }
    const reasons = [];
    if (existing.name !== definition.name)
        reasons.push(`name (${existing.name} → ${definition.name})`);
    reasons.push(...permissionReasons(existing, overwrites, missing));
    if (reasons.length === 0) {
        report.outcomes.push(base('category', definition.key, definition.name, 'unchanged'));
        return existing;
    }
    const outcome = base('category', definition.key, definition.name, 'updated', reasons);
    if (!options.dryRun) {
        try {
            await existing.edit({
                name: definition.name,
                permissionOverwrites: (0, overwrites_1.mergeOverwrites)(existing.permissionOverwrites.cache, overwrites),
                reason,
            });
            state_1.state.rememberCategory(definition.key, existing.id);
            logger_1.logger.info('SETUP', `Updated category: ${definition.name} (${reasons.join(', ')})`);
        }
        catch (error) {
            fail(outcome, error, `update the category ${definition.name}`);
        }
    }
    report.outcomes.push(outcome);
    return existing;
}
async function syncChannel(guild, botId, category, definition, parent, index, report, options, reason) {
    const label = channelLabel(definition);
    const wantedType = resolve_1.DISCORD_TYPE[definition.type];
    // A channel's effective permissions come from its own overwrites, so the
    // category's specs are written onto every child rather than relied upon.
    // Layered, so a channel can override its category in either direction.
    const { overwrites, missing } = (0, overwrites_1.resolveLayered)(guild, [category.overwrites, definition.overwrites ?? []], botId);
    // Text and announcement channels convert in place, so handle that before
    // resolution — otherwise the channel looks missing and gets duplicated.
    await convertTextType(guild, definition, wantedType, label, report, options, reason);
    const existing = (0, resolve_1.findChannel)(guild, definition.key);
    if (!existing) {
        // The channel may exist with the wrong type — a text channel the blueprint
        // now wants as a forum, say. Discord cannot convert between those, and this
        // code never deletes, so the situation is reported and left for
        // `npm run migrate:types` to resolve deliberately.
        const mistyped = (0, resolve_1.findChannelAnyType)(guild, definition.key);
        if (mistyped) {
            const outcome = base('channel', definition.key, label, 'failed');
            outcome.error =
                `"${mistyped.name}" exists as ${typeName(mistyped.type)} but the blueprint wants ${definition.type}. ` +
                    'Discord cannot convert between these types. Run `npm run migrate:types` to recreate it.';
            report.outcomes.push(outcome);
            return;
        }
        const outcome = base('channel', definition.key, label, 'created');
        if (options.dryRun) {
            report.outcomes.push(outcome);
            return;
        }
        try {
            const created = await guild.channels.create({
                name: definition.name,
                type: wantedType,
                position: index,
                permissionOverwrites: overwrites,
                ...(parent ? { parent: parent.id } : {}),
                // Voice and stage channels do not carry a topic; the blueprint's topic
                // is documentation for /server-status in that case.
                ...(supportsTopic(definition.type) && definition.topic
                    ? { topic: definition.topic }
                    : {}),
                ...(definition.rateLimitPerUser === undefined
                    ? {}
                    : { rateLimitPerUser: definition.rateLimitPerUser }),
                ...(definition.userLimit === undefined ? {} : { userLimit: definition.userLimit }),
                ...(definition.tags && definition.tags.length > 0
                    ? { availableTags: definition.tags.map((name) => ({ name, moderated: false })) }
                    : {}),
                ...(definition.layout ? { defaultForumLayout: forumLayout(definition.layout) } : {}),
                reason,
            });
            state_1.state.rememberChannel(definition.key, created.id);
            logger_1.logger.info('SETUP', `Created channel: ${label}`);
        }
        catch (error) {
            fail(outcome, error, `create the channel ${label}`);
        }
        report.outcomes.push(outcome);
        return;
    }
    const reasons = diffChannel(existing, definition, parent);
    reasons.push(...permissionReasons(existing, overwrites, missing));
    if (reasons.length === 0) {
        report.outcomes.push(base('channel', definition.key, label, 'unchanged'));
        return;
    }
    const outcome = base('channel', definition.key, label, 'updated', reasons);
    if (!options.dryRun) {
        const common = {
            name: definition.name,
            permissionOverwrites: (0, overwrites_1.mergeOverwrites)(existing.permissionOverwrites.cache, overwrites),
            ...(parent ? { parent: parent.id } : {}),
            reason,
        };
        try {
            // Each family takes a different edit payload, so the branch is real
            // rather than cosmetic.
            if (isTextLike(existing)) {
                await existing.edit({
                    ...common,
                    topic: definition.topic ?? null,
                    // Slowmode is meaningless on an announcement channel; sending it
                    // anyway is what produced the phantom drift.
                    ...(existing.type === discord_js_1.ChannelType.GuildText
                        ? { rateLimitPerUser: definition.rateLimitPerUser ?? 0 }
                        : {}),
                });
            }
            else if (isThreadOnly(existing)) {
                const tags = tagsToWrite(existing, definition);
                await existing.edit({
                    ...common,
                    topic: definition.topic ?? null,
                    ...(tags ? { availableTags: tags } : {}),
                    ...(definition.layout ? { defaultForumLayout: forumLayout(definition.layout) } : {}),
                });
            }
            else {
                await existing.edit({
                    ...common,
                    ...(definition.userLimit === undefined ? {} : { userLimit: definition.userLimit }),
                });
            }
            state_1.state.rememberChannel(definition.key, existing.id);
            logger_1.logger.info('SETUP', `Updated channel: ${label} (${reasons.join(', ')})`);
        }
        catch (error) {
            fail(outcome, error, `update the channel ${label}`);
        }
    }
    report.outcomes.push(outcome);
}
function diffChannel(channel, definition, parent) {
    const reasons = [];
    if (channel.name !== definition.name)
        reasons.push(`name (${channel.name} → ${definition.name})`);
    if (parent && channel.parentId !== parent.id)
        reasons.push('category');
    if (isTextLike(channel)) {
        if ((channel.topic ?? '') !== (definition.topic ?? ''))
            reasons.push('topic');
        // Announcement channels do not support slowmode and report it as null, so
        // comparing against 0 without the coalesce reports drift on every run.
        if (channel.type === discord_js_1.ChannelType.GuildText &&
            (channel.rateLimitPerUser ?? 0) !== (definition.rateLimitPerUser ?? 0)) {
            reasons.push('slowmode');
        }
    }
    if (isThreadOnly(channel)) {
        if ((channel.topic ?? '') !== (definition.topic ?? ''))
            reasons.push('guidelines');
        const missing = tagGap(channel, definition);
        if (missing.length > 0)
            reasons.push(`tags to add: ${missing.join(', ')}`);
        if (definition.layout &&
            channel.type === discord_js_1.ChannelType.GuildForum &&
            channel.defaultForumLayout !== forumLayout(definition.layout)) {
            reasons.push('layout');
        }
    }
    if ((channel.type === discord_js_1.ChannelType.GuildVoice || channel.type === discord_js_1.ChannelType.GuildStageVoice) &&
        definition.userLimit !== undefined &&
        channel.userLimit !== definition.userLimit) {
        reasons.push('user limit');
    }
    return reasons;
}
/**
 * Convert between text and announcement in place.
 *
 * These are the only two types Discord will convert without destroying the
 * channel, so this is the one type change setup can perform on its own.
 * Everything else is left to the explicit migration script.
 */
async function convertTextType(guild, definition, wantedType, label, report, options, reason) {
    const convertible = [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement];
    if (!convertible.includes(wantedType))
        return;
    const live = (0, resolve_1.findChannelAnyType)(guild, definition.key);
    if (!live || live.type === wantedType || !convertible.includes(live.type))
        return;
    if (options.dryRun) {
        report.notes.push(`${label} would be converted from ${typeName(live.type)} to ${definition.type}.`);
        return;
    }
    try {
        await live.edit({
            type: wantedType,
            reason,
        });
        report.notes.push(`${label} converted to ${definition.type}.`);
        logger_1.logger.info('SETUP', `Converted ${label} to ${definition.type}`);
    }
    catch (error) {
        report.warnings.push(`Could not convert ${label} to ${definition.type}.`);
        logger_1.logger.error('SETUP', `Type conversion failed for ${label}`, error);
    }
}
/* ── Channel type helpers ──────────────────────────────────── */
function isTextLike(channel) {
    return (channel.type === discord_js_1.ChannelType.GuildText || channel.type === discord_js_1.ChannelType.GuildAnnouncement);
}
function isThreadOnly(channel) {
    return channel.type === discord_js_1.ChannelType.GuildForum || channel.type === discord_js_1.ChannelType.GuildMedia;
}
function forumLayout(layout) {
    return layout === 'gallery' ? discord_js_1.ForumLayoutType.GalleryView : discord_js_1.ForumLayoutType.ListView;
}
function supportsTopic(type) {
    return type === 'text' || type === 'announcement' || type === 'forum' || type === 'media';
}
function channelLabel(definition) {
    switch (definition.type) {
        case 'text':
            return `#${definition.name}`;
        case 'announcement':
            return `#${definition.name} (announcement)`;
        case 'forum':
            return `${definition.name} (forum)`;
        case 'media':
            return `${definition.name} (media)`;
        case 'voice':
            return `${definition.name} (voice)`;
        case 'stage':
            return `${definition.name} (stage)`;
    }
}
function typeName(type) {
    const found = Object.entries(resolve_1.DISCORD_TYPE).find(([, value]) => value === type);
    return found ? found[0] : `type ${String(type)}`;
}
/** Blueprint tags that do not yet exist on the channel, compared by name. */
function tagGap(channel, definition) {
    const wanted = definition.tags ?? [];
    if (wanted.length === 0)
        return [];
    const present = new Set(channel.availableTags.map((tag) => tag.name.toLowerCase()));
    return wanted.filter((name) => !present.has(name.toLowerCase()));
}
/**
 * The tag list to write, or null when nothing is missing.
 *
 * Existing tags are passed back **with their IDs**: Discord treats a tag
 * without an ID as a new one, so rebuilding the list from names alone would
 * silently unfile every post already tagged. Tags are only ever added — a tag
 * someone created by hand is left in place.
 */
function tagsToWrite(channel, definition) {
    const missing = tagGap(channel, definition);
    if (missing.length === 0)
        return null;
    return [
        ...channel.availableTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            moderated: tag.moderated,
            emoji: tag.emoji,
        })),
        ...missing.map((name) => ({ name, moderated: false })),
    ];
}
/**
 * Permission drift, expressed for a human.
 * When roles are still missing (a dry run on an empty server), the diff would
 * be meaningless, so we say so instead of inventing one.
 */
function permissionReasons(channel, desired, missing) {
    if (missing.length > 0) {
        return [`permissions pending creation of: ${missing.join(', ')}`];
    }
    return (0, overwrites_1.diffOverwrites)(channel.permissionOverwrites.cache, desired).length > 0
        ? ['permissions']
        : [];
}
/* ── Reporting helpers ─────────────────────────────────────── */
/**
 * Channels the blueprint says nothing about.
 *
 * Resolved live rather than from state.json, so a dry run against a server the
 * bot has never provisioned does not report every existing channel as
 * unmanaged. These are reported and then left completely alone.
 */
function collectUnmanaged(guild, report) {
    report.unmanagedChannels = unmanagedNames(guild, managedChannelIds(guild));
}
function managedChannelIds(guild) {
    const ids = new Set();
    for (const category of server_1.SERVER.categories) {
        const resolved = (0, resolve_1.findCategory)(guild, category.key);
        if (resolved)
            ids.add(resolved.id);
        for (const channel of category.channels) {
            const live = (0, resolve_1.findChannel)(guild, channel.key);
            if (live)
                ids.add(live.id);
        }
    }
    return ids;
}
function unmanagedNames(guild, managed) {
    return [
        ...guild.channels.cache
            .filter((channel) => !managed.has(channel.id) &&
            channel.type !== discord_js_1.ChannelType.GuildCategory &&
            // Threads live inside channels we already account for.
            !channel.isThread())
            .map((channel) => channel.name),
    ];
}
function base(kind, key, label, status, reasons = []) {
    return { kind, key, label, status, reasons };
}
function fail(outcome, error, action) {
    outcome.status = 'failed';
    outcome.error = `Could not ${action}.`;
    logger_1.logger.error('SETUP', `Failed to ${action}`, error);
}
//# sourceMappingURL=provisioner.js.map