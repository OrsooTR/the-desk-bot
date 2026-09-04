"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const server_1 = require("../config/server");
const events_1 = require("../config/events");
const channelGuides_1 = require("../config/channelGuides");
const content_1 = require("../config/content");
const faq_1 = require("../config/faq");
/**
 * `roleDef` returns undefined for an unknown key because callers at runtime
 * have to cope with a missing role. Inside the verifier a miss is a blueprint
 * bug, so it throws loudly instead.
 */
function mustRole(key) {
    const definition = (0, server_1.roleDef)(key);
    if (!definition)
        throw new Error(`Blueprint has no role "${key}"`);
    return definition;
}
/* ────────────────────────────────────────────────────────────
 * Blueprint verification — `npm run verify`
 *
 * Two jobs, both offline:
 *
 *  1. Structural checks (duplicate keys, malformed channel names, references
 *     to roles that do not exist).
 *  2. A re-implementation of Discord's permission resolution algorithm, run
 *     against the blueprint, asserting what each role can actually do in each
 *     channel.
 *
 * The second is deliberately an *independent* implementation rather than a
 * call into src/permissions. A test that reuses the code it is testing only
 * proves the code agrees with itself; this one would catch the day someone
 * "simplifies" the layering rules and quietly opens #staff to everybody.
 * ──────────────────────────────────────────────────────────── */
const failures = [];
const checks = { passed: 0, failed: 0 };
function check(description, condition) {
    if (condition) {
        checks.passed += 1;
        return;
    }
    checks.failed += 1;
    failures.push(description);
}
/* ── 1. Structure ──────────────────────────────────────────── */
function verifyStructure() {
    const roleKeys = new Set();
    for (const role of server_1.SERVER.roles) {
        check(`role key "${role.key}" is unique`, !roleKeys.has(role.key));
        roleKeys.add(role.key);
    }
    const categoryKeys = new Set();
    const channelKeys = new Set();
    for (const category of server_1.SERVER.categories) {
        check(`category key "${category.key}" is unique`, !categoryKeys.has(category.key));
        categoryKeys.add(category.key);
        const namesInCategory = new Set();
        for (const channel of category.channels) {
            check(`channel key "${channel.key}" is unique`, !channelKeys.has(channel.key));
            channelKeys.add(channel.key);
            const nameKey = `${channel.type}:${channel.name.toLowerCase()}`;
            check(`channel name "${channel.name}" is unique within ${category.name}`, !namesInCategory.has(nameKey));
            namesInCategory.add(nameKey);
            // Discord lowercases and de-spaces text-like channel names server-side;
            // writing them that way in the blueprint keeps the diff stable. Emoji
            // and separators are fine — only ASCII case and whitespace are not.
            if (channel.type === 'text' || channel.type === 'announcement') {
                check(`text channel "${channel.name}" has no uppercase or spaces`, !/[A-Z\s]/.test(channel.name));
            }
            if (channel.type === 'forum' || channel.type === 'media') {
                check(`forum channel "${channel.name}" defines at least one tag`, (channel.tags?.length ?? 0) > 0);
                check(`forum channel "${channel.name}" stays within Discord's 20-tag limit`, (channel.tags?.length ?? 0) <= 20);
                const tagNames = new Set((channel.tags ?? []).map((tag) => tag.toLowerCase()));
                check(`forum channel "${channel.name}" has no duplicate tags`, tagNames.size === (channel.tags?.length ?? 0));
            }
            // Tags only exist on forum and media channels; setting them anywhere
            // else is a config mistake that Discord would silently ignore.
            if (channel.type !== 'forum' && channel.type !== 'media') {
                check(`"${channel.name}" does not define tags for a non-forum channel`, !channel.tags);
            }
            check(`channel "${channel.name}" has a topic no longer than 1024 characters`, (channel.topic?.length ?? 0) <= 1024);
        }
    }
    for (const key of [
        server_1.SERVER.logChannelKey,
        server_1.SERVER.welcomeChannelKey,
        server_1.SERVER.rulesChannelKey,
        server_1.SERVER.eventsChannelKey,
        server_1.SERVER.tradeReviewChannelKey,
        server_1.SERVER.faqChannelKey,
        server_1.SERVER.ticketChannelKey,
        server_1.SERVER.moderationChannelKey,
        server_1.SERVER.rolesChannelKey,
        server_1.SERVER.newsChannelKey,
    ]) {
        check(`referenced channel "${key}" exists in the blueprint`, channelKeys.has(key));
    }
    for (const key of [server_1.SERVER.joinRole, server_1.SERVER.verifiedRole]) {
        check(`referenced role "${key}" exists in the blueprint`, roleKeys.has(key));
    }
    // Every session format must point at a room that exists and can actually
    // host it. A typo here only surfaces when someone runs /event create.
    for (const preset of events_1.EVENT_PRESETS) {
        const venue = (0, server_1.allChannels)().find((entry) => entry.channel.key === preset.venueChannelKey)?.channel;
        check(`event preset "${preset.key}" points at an existing channel`, venue !== undefined);
        if (venue) {
            check(`event preset "${preset.key}" points at a voice or stage channel`, venue.type === 'voice' || venue.type === 'stage');
        }
    }
    // Every {{#channel}} / {{@role}} placeholder must resolve. An unresolvable
    // one degrades to plain grey text in production, which is exactly the bug
    // this whole mechanism exists to fix — so it fails the build instead.
    const placeholders = [
        ...JSON.stringify(channelGuides_1.CHANNEL_GUIDES).matchAll(/\{\{([#@])([a-zA-Z0-9_-]+)\}\}/g),
        ...JSON.stringify(content_1.WELCOME).matchAll(/\{\{([#@])([a-zA-Z0-9_-]+)\}\}/g),
        ...JSON.stringify(content_1.RULES).matchAll(/\{\{([#@])([a-zA-Z0-9_-]+)\}\}/g),
        ...JSON.stringify(faq_1.FAQ).matchAll(/\{\{([#@])([a-zA-Z0-9_-]+)\}\}/g),
    ];
    const allRoleKeys = new Set([
        ...server_1.SERVER.roles.map((r) => r.key),
        ...server_1.SERVER.selfRoles.map((r) => r.key),
    ]);
    for (const [, kind, key] of placeholders) {
        if (!kind || !key)
            continue;
        check(`mention placeholder {{${kind}${key}}} resolves`, kind === '#' ? channelKeys.has(key) : allRoleKeys.has(key));
    }
    // Voice hubs must be voice channels, and a restricted hub must name roles
    // that exist — otherwise the restriction silently permits everyone.
    for (const { channel } of (0, server_1.allChannels)()) {
        if (!channel.spawner)
            continue;
        check(`spawner "${channel.key}" is a voice channel`, channel.type === 'voice');
        for (const key of channel.spawner.restrictTo ?? []) {
            check(`spawner "${channel.key}" restricts to a known role (${key})`, roleKeys.has(key));
        }
    }
    // Every overwrite target must name a role that exists.
    for (const category of server_1.SERVER.categories) {
        const specs = [
            ...category.overwrites,
            ...category.channels.flatMap((channel) => channel.overwrites ?? []),
        ];
        for (const spec of specs) {
            if (spec.target.kind === 'role') {
                check(`overwrite in ${category.name} targets a known role (${spec.target.role})`, roleKeys.has(spec.target.role));
            }
        }
    }
}
/** Guild-level permissions for an actor: @everyone plus the role itself. */
function basePermissions(actor) {
    const everyone = new discord_js_1.PermissionsBitField(server_1.SERVER.everyonePermissions).bitfield;
    if (actor === 'everyone')
        return everyone;
    return everyone | new discord_js_1.PermissionsBitField(mustRole(actor).permissions).bitfield;
}
/** Collapse one layer for one actor: allow beats deny within the layer. */
function collapse(specs, actor) {
    const everyone = { allow: 0n, deny: 0n };
    const role = { allow: 0n, deny: 0n };
    for (const spec of specs) {
        const allow = new discord_js_1.PermissionsBitField(spec.allow ?? []).bitfield;
        const deny = new discord_js_1.PermissionsBitField(spec.deny ?? []).bitfield;
        if (spec.target.kind === 'everyone') {
            everyone.allow |= allow;
            everyone.deny |= deny;
        }
        else if (spec.target.kind === 'role' && spec.target.role === actor) {
            role.allow |= allow;
            role.deny |= deny;
        }
    }
    everyone.deny &= ~everyone.allow;
    role.deny &= ~role.allow;
    return { everyone, role };
}
function layer(previous, current) {
    return {
        allow: (previous.allow & ~current.deny) | current.allow,
        deny: (previous.deny & ~current.allow) | current.deny,
    };
}
/**
 * Discord's documented resolution order:
 *   base → @everyone overwrite → role denies → role allows.
 */
function effectivePermissions(actor, channelKey) {
    const entry = (0, server_1.allChannels)().find((candidate) => candidate.channel.key === channelKey);
    if (!entry)
        throw new Error(`No such channel in the blueprint: ${channelKey}`);
    const base = basePermissions(actor);
    if ((base & discord_js_1.PermissionFlagsBits.Administrator) === discord_js_1.PermissionFlagsBits.Administrator) {
        return discord_js_1.PermissionsBitField.All;
    }
    const fromCategory = collapse(entry.category.overwrites, actor);
    const fromChannel = collapse(entry.channel.overwrites ?? [], actor);
    const everyone = layer(fromCategory.everyone, fromChannel.everyone);
    const role = layer(fromCategory.role, fromChannel.role);
    let permissions = base;
    permissions &= ~everyone.deny;
    permissions |= everyone.allow;
    permissions &= ~role.deny;
    permissions |= role.allow;
    return permissions;
}
function can(actor, channelKey, permission) {
    const flag = discord_js_1.PermissionFlagsBits[permission];
    return (effectivePermissions(actor, channelKey) & flag) === flag;
}
function expect(actor, channelKey, permission, want) {
    check(`${actor} ${want ? 'CAN' : 'CANNOT'} ${permission} in ${channelKey}`, can(actor, channelKey, permission) === want);
}
function verifyPermissions() {
    // Staff is private — this is the check that matters most.
    for (const channel of ['staff', 'bot-logs', 'moderation']) {
        expect('everyone', channel, 'ViewChannel', false);
        expect('member', channel, 'ViewChannel', false);
        expect('researcher', channel, 'ViewChannel', false);
        expect('mentor', channel, 'ViewChannel', false);
        expect('newMember', channel, 'ViewChannel', false);
        expect('moderator', channel, 'ViewChannel', true);
        expect('admin', channel, 'ViewChannel', true);
    }
    expect('moderator', 'staff', 'SendMessages', true);
    // START HERE is readable by anyone who lands on the server, and read-only.
    expect('everyone', 'welcome', 'ViewChannel', true);
    expect('everyone', 'rules', 'ViewChannel', true);
    expect('member', 'welcome', 'SendMessages', false);
    expect('moderator', 'rules', 'SendMessages', false);
    expect('admin', 'rules', 'SendMessages', true);
    // Unverified accounts: general only, and no links or files there.
    expect('newMember', 'general', 'ViewChannel', true);
    expect('newMember', 'general', 'SendMessages', true);
    expect('newMember', 'general', 'AttachFiles', false);
    expect('newMember', 'general', 'EmbedLinks', false);
    expect('newMember', 'trading-floor', 'ViewChannel', false);
    expect('newMember', 'the-lab', 'ViewChannel', false);
    expect('newMember', 'italia', 'ViewChannel', false);
    expect('newMember', 'roles', 'ViewChannel', false);
    // The roles channel sits inside the @everyone-readable START HERE category,
    // so its channel-level deny has to beat the category allow. If layering ever
    // regresses, this is the check that catches it.
    expect('everyone', 'roles', 'ViewChannel', false);
    expect('member', 'roles', 'ViewChannel', true);
    expect('member', 'roles', 'SendMessages', false);
    // The main floor is open to verified members.
    for (const channel of ['general', 'trading-floor', 'the-lab']) {
        expect('member', channel, 'ViewChannel', true);
        expect('member', channel, 'SendMessages', true);
    }
    // Education: the open channel is open, the library accepts member posts.
    expect('member', 'education', 'SendMessages', true);
    expect('member', 'library', 'ViewChannel', true);
    expect('member', 'library', 'SendMessages', true);
    expect('member', 'library', 'SendMessagesInThreads', true);
    expect('mentor', 'library', 'ManageMessages', true);
    expect('member', 'library', 'ManageMessages', false);
    // The news feed is a log: the bot posts, members reply in the thread.
    expect('member', 'news-feed', 'ViewChannel', true);
    expect('member', 'news-feed', 'SendMessages', false);
    expect('member', 'news-feed', 'SendMessagesInThreads', true);
    expect('mentor', 'news-feed', 'SendMessages', true);
    // Events are announcements plus a discussion thread.
    expect('member', 'events', 'SendMessages', false);
    expect('member', 'events', 'SendMessagesInThreads', true);
    expect('mentor', 'events', 'SendMessages', true);
    // Voice: members reach the public hub and the Italian room, and nothing else.
    expect('member', 'voice-create-trading', 'Connect', true);
    expect('member', 'voice-desk-italia', 'Connect', true);
    expect('newMember', 'voice-create-trading', 'Connect', false);
    // The staff hub is the important one — it must be unreachable, not merely
    // hidden, or a member could still connect via a direct link.
    expect('member', 'voice-create-staff', 'ViewChannel', false);
    expect('member', 'voice-create-staff', 'Connect', false);
    expect('mentor', 'voice-create-staff', 'Connect', false);
    expect('researcher', 'voice-create-staff', 'Connect', false);
    expect('everyone', 'voice-create-staff', 'ViewChannel', false);
    expect('moderator', 'voice-create-staff', 'Connect', true);
    expect('admin', 'voice-create-staff', 'Connect', true);
    // Researchers organise the lab; ordinary members do not.
    expect('researcher', 'the-lab', 'ManageThreads', true);
    expect('member', 'the-lab', 'ManageThreads', false);
    // The stage: the audience asks to speak, the host decides.
    expect('member', 'stage-auditorium', 'Connect', true);
    expect('member', 'stage-auditorium', 'RequestToSpeak', true);
    expect('member', 'stage-auditorium', 'Speak', false);
    expect('member', 'stage-auditorium', 'ManageChannels', false);
    expect('mentor', 'stage-auditorium', 'Speak', true);
    expect('mentor', 'stage-auditorium', 'ManageChannels', true);
    expect('newMember', 'stage-auditorium', 'ViewChannel', false);
    // Support must be reachable by people who cannot get in yet — being locked
    // out is one of the main reasons to open a ticket in the first place.
    expect('newMember', 'tickets', 'ViewChannel', true);
    expect('newMember', 'faq', 'ViewChannel', true);
    expect('newMember', 'tickets', 'SendMessagesInThreads', true);
    expect('member', 'tickets', 'ViewChannel', true);
    // Both support channels are read-only: the FAQ is reference, and the ticket
    // channel is a button. Conversation happens inside the ticket thread.
    expect('member', 'tickets', 'SendMessages', false);
    expect('member', 'faq', 'SendMessages', false);
    expect('member', 'faq', 'SendMessagesInThreads', true);
    expect('moderator', 'tickets', 'SendMessages', true);
    expect('moderator', 'tickets', 'CreatePrivateThreads', true);
    expect('everyone', 'tickets', 'ViewChannel', false);
    // Members hold no dangerous permission anywhere.
    for (const channel of ['general', 'trading-floor', 'italia']) {
        expect('member', channel, 'ManageMessages', false);
        expect('member', channel, 'ManageChannels', false);
        expect('member', channel, 'ManageRoles', false);
        expect('member', channel, 'MentionEveryone', false);
    }
}
function verifyRoleHierarchy() {
    const admin = new discord_js_1.PermissionsBitField(mustRole('admin').permissions);
    const moderator = new discord_js_1.PermissionsBitField(mustRole('moderator').permissions);
    const mentor = new discord_js_1.PermissionsBitField(mustRole('mentor').permissions);
    const member = new discord_js_1.PermissionsBitField(mustRole('member').permissions);
    check('only @Founder holds Administrator', server_1.SERVER.roles.filter((role) => role.permissions.includes('Administrator')).length === 1 &&
        mustRole('founder').permissions.includes('Administrator'));
    check('@Admin can manage channels', admin.has(discord_js_1.PermissionFlagsBits.ManageChannels));
    check('@Admin can manage roles', admin.has(discord_js_1.PermissionFlagsBits.ManageRoles));
    check('@Moderator cannot manage channels', !moderator.has(discord_js_1.PermissionFlagsBits.ManageChannels));
    check('@Moderator cannot manage roles', !moderator.has(discord_js_1.PermissionFlagsBits.ManageRoles));
    check('@Moderator can time members out', moderator.has(discord_js_1.PermissionFlagsBits.ModerateMembers));
    check('@Mentor cannot moderate members', !mentor.has(discord_js_1.PermissionFlagsBits.ModerateMembers));
    check('@Mentor can manage events', mentor.has(discord_js_1.PermissionFlagsBits.ManageEvents));
    check('@Member cannot manage messages', !member.has(discord_js_1.PermissionFlagsBits.ManageMessages));
    check('@Member cannot mention everyone', !member.has(discord_js_1.PermissionFlagsBits.MentionEveryone));
    check('@Bot grants nothing', mustRole('bot').permissions.length === 0);
    check('@New Member cannot view channels by default', !new discord_js_1.PermissionsBitField(mustRole('newMember').permissions).has(discord_js_1.PermissionFlagsBits.ViewChannel));
    check('@everyone holds no baseline permissions', server_1.SERVER.everyonePermissions.length === 0);
}
/* ── Run ───────────────────────────────────────────────────── */
verifyStructure();
verifyRoleHierarchy();
verifyPermissions();
const totalChannels = (0, server_1.allChannels)().length;
console.log(`THE DESK blueprint: ${server_1.SERVER.roles.length} roles, ${server_1.SERVER.categories.length} categories, ${totalChannels} channels.`);
if (checks.failed === 0) {
    console.log(`All ${checks.passed} checks passed.`);
}
else {
    console.error(`${checks.failed} of ${checks.passed + checks.failed} checks FAILED:\n`);
    for (const failure of failures)
        console.error(`  ✗ ${failure}`);
    process.exitCode = 1;
}
//# sourceMappingURL=verifyBlueprint.js.map