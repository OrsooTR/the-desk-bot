"use strict";
/**
 * Recurring community sessions.
 *
 * These are *templates*, not a scheduler. `/event create` takes a preset,
 * a date and a time, then creates a native Discord Scheduled Event plus an
 * announcement in the events channel. Adding a recurring format to the
 * community is an edit to this file — nothing else.
 *
 * A future automatic scheduler (see README, "Future expansion") can consume
 * the optional `recurrence` hint without any change to the presets themselves.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_PRESETS = void 0;
exports.findPreset = findPreset;
exports.EVENT_PRESETS = [
    {
        key: 'market-review',
        title: 'THE DESK — Market Review',
        summary: 'We review the previous session and take it apart.',
        agenda: [
            'Market context and regime',
            'Key levels and how they behaved',
            'Execution: entries, exits, and the gap between plan and action',
            'Trade management',
            'Mistakes, named honestly',
            'What could have been done better',
        ],
        venueChannelKey: 'stage-auditorium',
        durationMinutes: 60,
        typicalHost: 'mentor',
        recurrence: 'Wednesdays 15:00 UTC',
    },
    {
        key: 'weekly-review',
        title: 'THE DESK — Weekly Review',
        summary: 'The week in aggregate: what the data says, not what it felt like.',
        agenda: [
            'The week across markets',
            'What changed in the regime',
            'Aggregate results: sample, expectancy, distribution',
            'Process adherence, separate from PnL',
            'One thing each of us changes next week',
        ],
        venueChannelKey: 'stage-auditorium',
        durationMinutes: 75,
        typicalHost: 'mentor',
        recurrence: 'Fridays 17:00 UTC',
    },
    {
        key: 'replay-session',
        title: 'THE DESK — Replay Session',
        summary: 'Bar-by-bar replay. Decisions made without knowing what comes next.',
        agenda: [
            'Replay a chosen session from the open',
            'Call the read out loud, before the outcome',
            'Define invalidation in advance',
            'Compare the decision to the outcome — and judge the decision',
        ],
        venueChannelKey: 'stage-auditorium',
        durationMinutes: 90,
        typicalHost: 'mentor',
        recurrence: 'Alternate Saturdays',
    },
    {
        key: 'strategy-lab',
        title: 'THE DESK — Strategy Lab',
        summary: 'A hypothesis is brought, tested and usually rejected. In public.',
        agenda: [
            'The hypothesis, stated precisely',
            'Data, period and universe',
            'Methodology and the biases it is exposed to',
            'Results, including the ones nobody wanted',
            'What would have to be true for this to survive',
        ],
        venueChannelKey: 'stage-auditorium',
        durationMinutes: 90,
        typicalHost: 'researcher',
        recurrence: 'Monthly',
    },
    {
        key: 'ama',
        title: 'THE DESK — AMA',
        summary: 'Open questions to the host. Nothing is off limits except tips.',
        agenda: [
            'Questions collected in advance in the events thread',
            'Live follow-ups',
            'No entries, no calls, no positions to copy',
        ],
        venueChannelKey: 'stage-auditorium',
        durationMinutes: 60,
        typicalHost: 'mentor',
    },
    {
        key: 'education-session',
        title: 'THE DESK — Educational Session',
        summary: 'A single concept, taught properly, with the caveats attached.',
        agenda: [
            'The concept and where it comes from',
            'What it does and does not tell you',
            'Worked examples',
            'How to test it yourself',
        ],
        venueChannelKey: 'stage-auditorium',
        durationMinutes: 60,
        typicalHost: 'mentor',
    },
    {
        key: 'guest-session',
        title: 'THE DESK — Guest Session',
        summary: 'An invited trader or researcher walks through how they actually work.',
        agenda: [
            'Background and mandate',
            'Process, research and risk framework',
            'Live questions from the desk',
        ],
        venueChannelKey: 'stage-auditorium',
        durationMinutes: 75,
        typicalHost: 'admin',
    },
];
function findPreset(key) {
    return exports.EVENT_PRESETS.find((preset) => preset.key === key);
}
//# sourceMappingURL=events.js.map