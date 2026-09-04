"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_HIERARCHY = exports.SERVER = void 0;
exports.allRoleDefinitions = allRoleDefinitions;
exports.allChannels = allChannels;
exports.channelDef = channelDef;
exports.roleDef = roleDef;
const selfRoles_1 = require("./selfRoles");
const permissionPresets_1 = require("./permissionPresets");
/* ────────────────────────────────────────────────────────────
 * Role groups — keep the overwrites below readable.
 * ──────────────────────────────────────────────────────────── */
/** Anyone with moderation duty. */
const STAFF = ['moderator', 'admin', 'founder'];
/** Anyone who can run the server. */
const LEADERSHIP = ['admin', 'founder'];
/** Anyone who curates educational material or hosts sessions. */
const EDUCATORS = ['mentor', ...STAFF];
/** Every verified human. `newMember` is deliberately excluded. */
const COMMUNITY = ['member', 'researcher', 'mentor', ...STAFF];
/* ────────────────────────────────────────────────────────────
 * THE DESK — server blueprint
 *
 * This object is the single source of truth. /setup, /setup-dry-run and
 * /server-status all read from here; nothing about the server's shape is
 * expressed anywhere else in the codebase.
 *
 * To add a channel: add an entry to a category's channel list, run /setup.
 * To add a role: add an entry to roles (ordered high to low), run /setup.
 * Keys are permanent identifiers. Rename `name` freely, never rename `key`.
 *
 * Prose that needs to link to a channel uses `{{#channel-key}}` rather than
 * "#channel-name" — Discord only renders a real link from a channel id, and
 * the key survives renames. See services/mentions.ts.
 *
 * On channel types: text and voice are the minority here on purpose. A trade
 * review, a study and a lesson are all things somebody needs to find again in
 * four months, which makes them forum posts with tags, not messages scrolling
 * away in a chat.
 * ──────────────────────────────────────────────────────────── */
exports.SERVER = {
    joinRole: 'newMember',
    verifiedRole: 'member',
    logChannelKey: 'bot-logs',
    welcomeChannelKey: 'welcome',
    rulesChannelKey: 'rules',
    eventsChannelKey: 'events',
    tradeReviewChannelKey: 'the-lab',
    faqChannelKey: 'faq',
    ticketChannelKey: 'tickets',
    moderationChannelKey: 'moderation',
    rolesChannelKey: 'roles',
    newsChannelKey: 'news-feed',
    /**
     * @everyone holds nothing. Access is granted explicitly, per category.
     * Consequence: any channel created manually later is private by default —
     * a safe failure mode rather than an accidental leak.
     */
    everyonePermissions: [],
    /**
     * Palette: saturated enough to read at a glance in the member list, but
     * kept to one hue per role with no gradients. Authority runs warm
     * (amber → vermilion), function runs cool (blue → teal → violet), and the
     * ordinary member tiers stay slate so the hierarchy is legible.
     */
    roles: [
        {
            key: 'founder',
            name: 'Founder',
            color: 0xf2a93b,
            hoist: true,
            mentionable: false,
            permissions: ['Administrator'],
            purpose: 'Server owner. The only role holding Administrator.',
        },
        {
            key: 'admin',
            name: 'Admin',
            color: 0xe0533d,
            hoist: true,
            mentionable: false,
            // Deliberately NOT Administrator: that bit bypasses every channel
            // overwrite, including the ones keeping #staff private.
            permissions: permissionPresets_1.ADMIN_GUILD_PERMISSIONS,
            purpose: 'Server administration: channels, roles, settings, webhooks.',
        },
        {
            key: 'moderator',
            name: 'Moderator',
            color: 0x3b82f6,
            hoist: true,
            mentionable: false,
            permissions: permissionPresets_1.MODERATOR_GUILD_PERMISSIONS,
            purpose: 'Community moderation: messages, timeouts, kicks, bans.',
        },
        {
            key: 'mentor',
            name: 'Mentor',
            color: 0x14b8a6,
            hoist: true,
            mentionable: true,
            // Elevated only where it matters: education + live sessions, via overwrites.
            permissions: (0, permissionPresets_1.merge)(permissionPresets_1.MEMBER_GUILD_PERMISSIONS, ['ManageEvents']),
            purpose: 'Curates educational content and hosts live sessions.',
        },
        {
            key: 'researcher',
            name: 'Researcher',
            color: 0xa855f7,
            hoist: false,
            mentionable: true,
            permissions: permissionPresets_1.MEMBER_GUILD_PERMISSIONS,
            purpose: 'Recognised contributor to the lab. Organises research posts.',
        },
        {
            key: 'member',
            name: 'Member',
            color: 0x94a3b8,
            hoist: false,
            mentionable: false,
            permissions: permissionPresets_1.MEMBER_GUILD_PERMISSIONS,
            purpose: 'Verified member with full access to the community areas.',
        },
        {
            key: 'newMember',
            name: 'New Member',
            color: 0x64748b,
            hoist: false,
            mentionable: false,
            // No ViewChannel: access comes only from explicit overwrites.
            permissions: ['ReadMessageHistory', 'UseApplicationCommands', 'ChangeNickname'],
            purpose: 'Assigned on join. Sees welcome, rules and general until verified.',
        },
        {
            key: 'bot',
            name: 'Bot',
            color: 0x475569,
            hoist: false,
            mentionable: false,
            // A label, not a permission source. See README, "Role hierarchy caveat".
            permissions: [],
            purpose: 'Cosmetic marker for bot accounts. Grants nothing.',
        },
    ],
    /** Cosmetic, member-chosen. Defined in config/selfRoles.ts. */
    selfRoles: (0, selfRoles_1.selfRoleDefinitions)(),
    categories: [
        /* ── 1. START HERE ─────────────────────────────────────── */
        {
            key: 'start-here',
            name: 'START HERE',
            purpose: 'What THE DESK is, the rules, and your roles.',
            overwrites: [
                // Readable by anyone who lands on the server, including accounts that
                // have not been assigned a role yet. Read-only by construction.
                {
                    target: permissionPresets_1.everyone,
                    allow: permissionPresets_1.READ,
                    deny: ['SendMessages', 'AddReactions', 'CreatePublicThreads', 'SendMessagesInThreads'],
                },
                ...(0, permissionPresets_1.allowRoles)(LEADERSHIP, permissionPresets_1.POST),
                { target: permissionPresets_1.self, allow: (0, permissionPresets_1.merge)(permissionPresets_1.READ, permissionPresets_1.POST) },
            ],
            channels: [
                {
                    key: 'welcome',
                    name: '🧭│welcome',
                    type: 'text',
                    topic: 'What THE DESK is, how it works, and what is expected of you.',
                },
                {
                    key: 'rules',
                    name: '📜│rules',
                    type: 'text',
                    topic: 'Community rules. Read them, then verify to unlock the server.',
                },
                {
                    // Verified members only: the menus are meaningless to an account
                    // that has not accepted the rules yet. The channel-level deny
                    // overrides the category's @everyone allow — layering, see
                    // permissions/overwrites.ts.
                    key: 'roles',
                    name: '🎭│roles',
                    type: 'text',
                    topic: 'Pick your language and the order flow software you actually run. Funded verification is requested here too.',
                    overwrites: [
                        { target: permissionPresets_1.everyone, deny: ['ViewChannel'] },
                        ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.READ, permissionPresets_1.REACT, ['UseApplicationCommands']),
                    ],
                },
            ],
        },
        /* ── 2. THE DESK ───────────────────────────────────────── */
        {
            key: 'the-desk',
            name: 'THE DESK',
            purpose: 'The main floor: discussion, evidence, market context.',
            overwrites: [
                permissionPresets_1.HIDDEN_FROM_EVERYONE,
                ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.DISCUSS),
                ...(0, permissionPresets_1.allowRoles)(STAFF, permissionPresets_1.CURATE),
            ],
            channels: [
                {
                    key: 'general',
                    name: '💬│general',
                    type: 'text',
                    topic: 'General discussion. Off-topic welcome, keep it civil.',
                    // The one channel unverified accounts can talk in. No links, no files.
                    overwrites: [{ target: (0, permissionPresets_1.role)('newMember'), allow: permissionPresets_1.DISCUSS_UNVERIFIED }],
                },
                {
                    key: 'trading-floor',
                    name: '📈│trading-floor',
                    type: 'text',
                    topic: 'Live market discussion: ideas, setups, structure, order flow, execution, risk, psychology. Ideas are argued, not asserted.',
                },
                {
                    // One forum, both jobs. A trade review and a research study are the
                    // same activity at different scales — a claim, the evidence, and an
                    // honest verdict — and tags separate them far better than two
                    // half-populated channels did.
                    key: 'the-lab',
                    name: '🔬│the-lab',
                    type: 'forum',
                    topic: 'One post per trade or per study. Trades: context, thesis, entry, risk, management, exit, result. Studies: hypothesis, data, period, method — then the result. Tag it so it can be found again. "Rejected" is a successful outcome.',
                    tags: [
                        'Trade review',
                        'Hypothesis',
                        'Backtest',
                        'Data study',
                        'Long',
                        'Short',
                        'Asia',
                        'London',
                        'New York',
                        'Win',
                        'Loss',
                        'Process error',
                        'Market regime',
                        'In progress',
                        'Validated',
                        'Rejected',
                        'Feedback wanted',
                    ],
                    overwrites: [
                        { target: (0, permissionPresets_1.role)('researcher'), allow: ['ManageThreads', 'CreatePrivateThreads'] },
                    ],
                },
                {
                    // A feed, not a chat. The bot posts the daily digest; conversation
                    // happens in the thread under it, so the timeline stays readable.
                    key: 'news-feed',
                    name: '📰│news-feed',
                    type: 'text',
                    topic: 'Automated daily market digest: central banks, macro releases, statistics. Discuss inside the thread on each digest.',
                    overwrites: [
                        ...(0, permissionPresets_1.denyRoles)(COMMUNITY, ['SendMessages', 'CreatePublicThreads']),
                        ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.THREAD_REPLY),
                        ...(0, permissionPresets_1.allowRoles)(EDUCATORS, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE),
                        { target: permissionPresets_1.self, allow: (0, permissionPresets_1.merge)(permissionPresets_1.READ, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE) },
                    ],
                },
            ],
        },
        /* ── 3. EDUCATION ──────────────────────────────────────── */
        {
            key: 'education',
            name: 'EDUCATION',
            purpose: 'Curated educational material. English only.',
            overwrites: [
                permissionPresets_1.HIDDEN_FROM_EVERYONE,
                // Members read and reply in threads everywhere; posting is per-channel.
                ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.READ, permissionPresets_1.REACT, permissionPresets_1.THREAD_REPLY, ['UseApplicationCommands']),
                // Members hold SendMessages at guild level, so a curated channel has to
                // deny it explicitly. Channels that are open re-allow it below, and the
                // educator allow always wins over this deny (see resolveOverwrites).
                ...(0, permissionPresets_1.denyRoles)(COMMUNITY, ['SendMessages', 'CreatePublicThreads']),
                ...(0, permissionPresets_1.allowRoles)(EDUCATORS, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE, permissionPresets_1.CURATE),
            ],
            channels: [
                {
                    key: 'education',
                    name: '🎓│education',
                    type: 'text',
                    topic: 'Ask and discuss anything educational. English.',
                    overwrites: [...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE)],
                },
                {
                    // Lessons, resources and videos merged into one library. Splitting
                    // them produced three thin channels; one forum with a real tag
                    // vocabulary is searchable, which is the only thing that matters
                    // for reference material.
                    //
                    // Members may open a post — a resource worth sharing should not need
                    // a Mentor — but the syllabus tags keep it navigable.
                    key: 'library',
                    name: '📚│library',
                    type: 'forum',
                    topic: 'Lessons, books, papers, tools, datasets and video. One post per item, tagged. Say why it is worth the time — a link with no argument is noise.',
                    tags: [
                        'Lesson',
                        'Book',
                        'Paper',
                        'Tool',
                        'Dataset',
                        'Video',
                        'Market structure',
                        'Order flow',
                        'Volume profile',
                        'VWAP',
                        'Futures',
                        'Risk management',
                        'Statistics',
                        'Execution',
                        'Psychology',
                        'Backtesting',
                        'Market regimes',
                    ],
                    overwrites: [...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE)],
                },
            ],
        },
        /* ── 4. LIVE DESK ──────────────────────────────────────── */
        {
            key: 'live-desk',
            name: 'LIVE DESK',
            purpose: 'Live sessions: on-demand rooms and hosted talks.',
            overwrites: [
                permissionPresets_1.HIDDEN_FROM_EVERYONE,
                ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.DISCUSS),
                ...(0, permissionPresets_1.allowRoles)(STAFF, permissionPresets_1.CURATE),
            ],
            channels: [
                {
                    key: 'live-trading',
                    name: '🔴│live-trading',
                    type: 'text',
                    topic: 'Text channel for whoever is in a voice room during live sessions.',
                },
                {
                    // Join-to-create. Standing empty rooms make a server look dead;
                    // a room that exists only while someone is in it does not.
                    key: 'voice-create-trading',
                    name: '➕ Create Trading Room',
                    type: 'voice',
                    userLimit: 1,
                    spawner: {
                        namePattern: "{user}'s Desk",
                        userLimit: 6,
                    },
                    overwrites: [...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.VOICE), ...(0, permissionPresets_1.allowRoles)(EDUCATORS, permissionPresets_1.VOICE_HOST)],
                },
                {
                    // Staff-only hub. The restriction is enforced by Discord — nobody
                    // below Moderator can connect to the hub at all — rather than by the
                    // bot deciding after the fact.
                    key: 'voice-create-staff',
                    name: '➕ Create Staff Room',
                    type: 'voice',
                    userLimit: 1,
                    spawner: {
                        namePattern: 'Staff — {user}',
                        userLimit: 0,
                        restrictTo: ['moderator', 'admin', 'founder'],
                        private: true,
                    },
                    overwrites: [
                        { target: permissionPresets_1.everyone, deny: ['ViewChannel', 'Connect'] },
                        ...(0, permissionPresets_1.denyRoles)(COMMUNITY, ['Connect', 'ViewChannel']),
                        ...(0, permissionPresets_1.allowRoles)(STAFF, permissionPresets_1.VOICE, permissionPresets_1.VOICE_HOST, ['ViewChannel', 'Connect']),
                    ],
                },
                {
                    // A stage, not a voice room: for AMAs and guest sessions the audience
                    // listens and raises a hand rather than everyone holding a microphone.
                    key: 'stage-auditorium',
                    name: '🏛 Auditorium',
                    type: 'stage',
                    overwrites: [
                        ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.STAGE_AUDIENCE),
                        // Members hold Speak at guild level, so it has to be taken away
                        // here — otherwise everyone arrives already on the microphone and
                        // the stage is just a voice room with extra steps. The educator
                        // allow below wins over this deny (same layer, allow beats deny).
                        ...(0, permissionPresets_1.denyRoles)(COMMUNITY, ['Speak', 'Stream']),
                        ...(0, permissionPresets_1.allowRoles)(EDUCATORS, permissionPresets_1.STAGE_HOST),
                    ],
                },
            ],
        },
        /* ── 5. EVENTS ─────────────────────────────────────────── */
        {
            key: 'events',
            name: 'EVENTS',
            purpose: 'Scheduled community sessions.',
            overwrites: [
                permissionPresets_1.HIDDEN_FROM_EVERYONE,
                // Announcements only. Members react and discuss in the thread attached
                // to each announcement; they cannot post at top level.
                ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.READ, permissionPresets_1.REACT, permissionPresets_1.THREAD_REPLY, ['UseApplicationCommands']),
                ...(0, permissionPresets_1.denyRoles)(COMMUNITY, ['SendMessages', 'CreatePublicThreads']),
                ...(0, permissionPresets_1.allowRoles)(EDUCATORS, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE, permissionPresets_1.CURATE),
                { target: permissionPresets_1.self, allow: (0, permissionPresets_1.merge)(permissionPresets_1.READ, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE) },
            ],
            channels: [
                {
                    key: 'events',
                    name: '🗓│events',
                    type: 'announcement',
                    topic: 'Market Reviews, Weekly Reviews, Replay Sessions, Strategy Lab, AMAs, guest sessions. Managed with /event.',
                },
            ],
        },
        /* ── 6. ITALIA ─────────────────────────────────────────── */
        {
            key: 'italia',
            name: 'ITALIA',
            purpose: 'Dedicated Italian-language area. Compact by design.',
            overwrites: [
                permissionPresets_1.HIDDEN_FROM_EVERYONE,
                ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.DISCUSS),
                ...(0, permissionPresets_1.allowRoles)(STAFF, permissionPresets_1.CURATE),
            ],
            channels: [
                {
                    key: 'italia',
                    name: '🇮🇹│italia',
                    type: 'text',
                    topic: 'Discussione generale in italiano. Il resto del server resta in inglese.',
                },
                {
                    key: 'trading-italia',
                    name: '📊│trading-italia',
                    type: 'text',
                    topic: 'Discussione di mercato in italiano: idee, struttura, esecuzione, rischio. Le review complete vanno in {{#the-lab}}, in inglese.',
                },
                {
                    key: 'voice-desk-italia',
                    name: '🗣 Desk Italia',
                    type: 'voice',
                    topic: 'Stanza vocale italiana.',
                    overwrites: [...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.VOICE)],
                },
            ],
        },
        /* ── 7. SUPPORT ────────────────────────────────────────── */
        {
            key: 'support',
            name: 'SUPPORT',
            purpose: 'Answers, and a private line to the staff.',
            overwrites: [
                permissionPresets_1.HIDDEN_FROM_EVERYONE,
                // Both channels are read-only: the FAQ is reference material, and the
                // ticket channel is a button, not a chat. Tickets happen in private
                // threads, which need ViewChannel on the parent to be reachable.
                ...(0, permissionPresets_1.allowRoles)(COMMUNITY, permissionPresets_1.READ, permissionPresets_1.REACT, permissionPresets_1.THREAD_REPLY, ['UseApplicationCommands']),
                ...(0, permissionPresets_1.denyRoles)(COMMUNITY, ['SendMessages', 'CreatePublicThreads']),
                // Unverified members must be able to ask for help — that is often
                // exactly why they cannot get in.
                ...(0, permissionPresets_1.allowRoles)(['newMember'], permissionPresets_1.READ, permissionPresets_1.THREAD_REPLY, ['UseApplicationCommands']),
                ...(0, permissionPresets_1.allowRoles)(STAFF, permissionPresets_1.POST, permissionPresets_1.CURATE, ['CreatePrivateThreads', 'ManageThreads']),
                { target: permissionPresets_1.self, allow: (0, permissionPresets_1.merge)(permissionPresets_1.READ, permissionPresets_1.POST, ['CreatePrivateThreads', 'ManageThreads']) },
            ],
            channels: [
                {
                    key: 'faq',
                    name: '❓│faq',
                    type: 'text',
                    topic: 'Answers to the questions that come up most. Run /faq to search them.',
                },
                {
                    key: 'tickets',
                    name: '🎫│open-a-ticket',
                    type: 'text',
                    topic: 'Press the button to open a private ticket with the staff. Only you and the staff can read it.',
                },
            ],
        },
        /* ── 8. STAFF ──────────────────────────────────────────── */
        {
            key: 'staff',
            name: 'STAFF',
            purpose: 'Private. Staff coordination, moderation records and bot output.',
            overwrites: [
                permissionPresets_1.HIDDEN_FROM_EVERYONE,
                ...(0, permissionPresets_1.allowRoles)(STAFF, permissionPresets_1.DISCUSS, permissionPresets_1.CURATE, ['CreatePrivateThreads']),
                // The bot must be able to write here even before roles are sorted out.
                { target: permissionPresets_1.self, allow: (0, permissionPresets_1.merge)(permissionPresets_1.READ, permissionPresets_1.POST, permissionPresets_1.THREAD_CREATE) },
            ],
            channels: [
                { key: 'staff', name: '🛡│staff', type: 'text', topic: 'Staff coordination.' },
                {
                    key: 'bot-logs',
                    name: '🧾│bot-logs',
                    type: 'text',
                    topic: 'Structured bot output: setup, provisioning, moderation, events, errors.',
                },
                {
                    key: 'moderation',
                    name: '⚖│moderation',
                    type: 'text',
                    topic: 'Moderation notes, reports and case history.',
                },
            ],
        },
    ],
};
/** Role hierarchy, highest authority first. Used by the command guards. */
exports.ROLE_HIERARCHY = exports.SERVER.roles.map((r) => r.key);
/** Core roles plus the self-assignable ones. Used for resolution only. */
function allRoleDefinitions() {
    return [...exports.SERVER.roles, ...exports.SERVER.selfRoles];
}
/** Flat view of every managed channel, with its owning category. */
function allChannels() {
    return exports.SERVER.categories.flatMap((category) => category.channels.map((channel) => ({ category, channel })));
}
/** Look up a channel definition by key, or undefined if it is not managed. */
function channelDef(key) {
    return allChannels().find((entry) => entry.channel.key === key);
}
/** Look up any role definition by key, core or self-assignable. */
function roleDef(key) {
    return allRoleDefinitions().find((r) => r.key === key);
}
//# sourceMappingURL=server.js.map