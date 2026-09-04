"use strict";
/**
 * The pinned card at the top of each channel.
 *
 * A channel topic is one line and most people never read it. This is the
 * standing answer to "what goes here, and what does not" — published by
 * `/setup` and edited in place on re-run, so it never accumulates duplicates.
 *
 * Cross-references use `{{#channel-key}}`, which becomes a real clickable
 * channel link at publish time. Writing "#the-lab" by hand produces dead grey
 * text — see services/mentions.ts.
 *
 * Keyed by blueprint channel key. A channel with no entry gets no card.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHANNEL_GUIDES = void 0;
exports.guideFor = guideFor;
exports.CHANNEL_GUIDES = {
    roles: {
        headline: 'Tell the server who you are.',
        belongs: [
            'Your language, so people know which one you are comfortable in',
            'The order flow software you actually run',
            'A funded verification request, if that applies to you',
        ],
        standard: 'Select to add a role, deselect to remove it. Funded status is checked by a human — the menus above are not.',
    },
    general: {
        headline: 'The common room. Everything that is not a market question.',
        belongs: [
            'Introductions — what you trade and what you are working on',
            'Off-topic conversation, within reason',
            'Questions when you do not know which channel to use',
        ],
        avoid: ['Detailed market analysis — that belongs in {{#trading-floor}}'],
        standard: 'Unverified accounts can talk here, but cannot post links or files.',
    },
    'trading-floor': {
        headline: 'Live market discussion. The heart of the server.',
        belongs: [
            'Ideas, setups and observations, with the reasoning attached',
            'Market structure, order flow, execution and risk',
            'Trading psychology and the gap between plan and action',
        ],
        avoid: ['Bare calls with no thesis', 'Asking for entries'],
        standard: 'State what would invalidate your idea. An idea with no invalidation is not an idea, it is a hope. Finished trades and full studies go in {{#the-lab}}.',
    },
    'the-lab': {
        headline: 'Where claims are tested. Trades and research, one post each.',
        belongs: [
            '**Trade reviews** — context, thesis, entry, risk, management, exit, result, and an honest post-mortem',
            '**Studies** — a hypothesis stated precisely enough to be wrong, with the data, period and method',
            'Negative results. Tag them Rejected and post them anyway',
            'Requests for a second pair of eyes — tag Feedback wanted',
        ],
        avoid: ['Screenshots of a PnL with no reasoning attached'],
        standard: 'Run `/review` to open a structured trade post. Method before result: if you cannot state the sample size, you do not have a finding yet. A profitable trade taken badly is still a bad trade.',
    },
    'news-feed': {
        headline: 'Automated daily digest from primary sources.',
        belongs: [
            'Discussion of a release, inside the thread on that digest',
            'Context on what a number actually means',
        ],
        avoid: ['Top-level posts — the channel is a log, not a chat'],
        standard: 'Posted every morning at 06:30 UTC from central bank and statistics feeds. Reply in the thread under a digest, or take a broader discussion to {{#trading-floor}}.',
    },
    education: {
        headline: 'Ask anything. Nobody is mocked for not knowing something.',
        belongs: [
            'Questions at any level',
            'Explanations, corrections and worked examples',
            'Discussion of material posted in {{#library}}',
        ],
        standard: 'English, so that one answer serves everybody.',
    },
    library: {
        headline: 'Lessons and reference material. One post per item, tagged.',
        belongs: [
            'Written lessons, from Mentors and from anyone who can teach it well',
            'Books, papers, tools, datasets and video',
            'A sentence on why it is worth the time',
        ],
        avoid: ['Bare links', 'Anything you are affiliated with, undisclosed'],
        standard: 'Tag your post — the tags are the syllabus, and filtering by one lets you follow a subject end to end. Run `/resources` for the curated starting list.',
    },
    'live-trading': {
        headline: 'Text channel for whoever is in a voice room right now.',
        belongs: ['Levels and charts being discussed live', 'Links for people who just joined'],
        standard: 'Open a room from **➕ Create Trading Room** — it exists only while someone is in it. Conclusions afterwards go to {{#trading-floor}} or {{#the-lab}}.',
    },
    events: {
        headline: 'Scheduled sessions. Announcements only.',
        belongs: ['Questions and notes inside each announcement thread'],
        standard: 'RSVP through the event above the channel list and Discord will remind you. Run `/event list` for what is coming.',
    },
    italia: {
        headline: 'Area italiana. Discussione generale.',
        belongs: [
            'Presentazioni e conversazione in italiano',
            'Domande di chi preferisce scrivere in italiano',
        ],
        standard: 'Il resto del server resta in inglese, materiale didattico compreso. Le review complete vanno in {{#the-lab}}.',
    },
    'trading-italia': {
        headline: 'Discussione di mercato in italiano.',
        belongs: [
            'Idee, struttura, order flow, esecuzione, rischio',
            'Domande sulle lezioni in inglese, poste in italiano',
        ],
        standard: 'Le stesse regole del trading floor: si argomenta, non si afferma. Le review e le ricerche complete vanno in {{#the-lab}}, in inglese, così le legge tutto il server.',
    },
    faq: {
        headline: 'The questions that come up most, answered once.',
        belongs: [],
        standard: 'Run `/faq` to search these. Not here? Open a ticket in {{#tickets}}.',
    },
    tickets: {
        headline: 'A private line to the staff.',
        belongs: [
            'Reporting a member, with a message link',
            'Appealing a moderation decision',
            'Verification problems, or anything you would rather not say in public',
            'A message AutoMod blocked by mistake',
        ],
        standard: 'Press the button below. It opens a private thread only you and the staff can read. Do not DM moderators directly.',
    },
    staff: {
        headline: 'Staff coordination.',
        belongs: ['Decisions, handovers, and anything needing more than one pair of eyes'],
    },
    'bot-logs': {
        headline: 'Structured bot output.',
        belongs: ['Setup and provisioning, permission changes, moderation actions, errors'],
        standard: 'Written automatically. Do not chat here — it makes the log unreadable.',
    },
    moderation: {
        headline: 'Case history.',
        belongs: [
            'Every warning, timeout, kick and ban, with the reason',
            'AutoMod alerts',
            'Anti-nuke alerts',
            'Funded verification decisions',
        ],
        standard: 'Cases are records. Discuss the decision in {{#staff}}, not here.',
    },
};
function guideFor(channelKey) {
    return exports.CHANNEL_GUIDES[channelKey];
}
//# sourceMappingURL=channelGuides.js.map