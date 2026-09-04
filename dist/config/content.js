"use strict";
/**
 * Static community text: the welcome brief and the rules.
 *
 * Kept as data (not embedded in the publishing code) so the tone of the server
 * can be edited without touching a single line of logic. `/setup` publishes
 * these and, on re-run, edits the existing message in place rather than
 * reposting — the message IDs live in state.json.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERIFICATION = exports.RULES = exports.WELCOME = void 0;
exports.WELCOME = {
    title: 'THE DESK',
    intro: 'An international trading community built around research, process and execution.\n' +
        'This is a place to develop a real skill set — slowly, and with evidence.',
    sections: [
        {
            heading: 'WHAT THIS IS',
            body: [
                'A working environment for traders who want to understand markets rather than be told what to buy.',
                'The focus is market structure, order flow, execution, statistics, risk and the psychology of doing this consistently.',
                'Members are expected to contribute: post research, argue positions, review your own trades honestly.',
            ].join('\n\n'),
        },
        {
            heading: 'WHAT THIS IS NOT',
            body: [
                'Not a signals service. Nobody here will hand you entries.',
                'Not a course funnel. Nothing is being sold to you.',
                'Not a guru server. No one is above being asked for their sample size.',
                'There are no guaranteed profits, and no one here will pretend otherwise.',
            ].join('\n'),
        },
        {
            heading: 'LANGUAGE',
            body: [
                'English is the primary language of the server. All educational material is in English.',
                'Italian members have a dedicated area in {{#italia}} and {{#trading-italia}} — general discussion and market talk in Italian.',
                'The Italian section is a place to talk freely, not a second server. Education stays in one place.',
            ].join('\n\n'),
        },
        {
            heading: 'HOW TO START',
            body: [
                '**1.** Read the rules in {{#rules}} and accept them to unlock the server.',
                '**2.** Introduce yourself in {{#general}} — what you trade, what you are working on.',
                '**3.** Pick your roles in {{#roles}}, then read {{#trading-floor}} before posting there.',
                '**4.** Post a trade in {{#the-lab}} using `/review`. Reviewing losses openly is the fastest way to earn credibility here.',
            ].join('\n'),
        },
        {
            heading: 'ON LOSSES',
            body: 'Losing periods are a normal property of any strategy with positive expectancy. ' +
                'A drawdown is not proof that a method is broken, and a winning week is not proof that it works. ' +
                'Sample size decides. We talk in probabilities, scenarios and invalidation — not certainty.',
        },
    ],
    closing: 'No financial advice is given here. Nothing in this server is a recommendation to trade. ' +
        'You are responsible for your own risk.',
};
exports.RULES = {
    title: 'COMMUNITY RULES',
    intro: 'These rules exist to keep the signal-to-noise ratio high. They are enforced consistently, ' +
        'regardless of who you are or how long you have been here.',
    rules: [
        '**No financial guarantees.** Never claim guaranteed returns, "risk-free" methods or certain outcomes. Speak in probabilities.',
        '**No signal selling.** Do not sell, advertise or route people to signal services, copy-trading or paid groups. Ask staff first for anything commercial.',
        '**No unsolicited promotion.** No advertising your channel, discord, course, bot or product in DMs or public channels.',
        '**No referral spam.** No broker, prop-firm or exchange referral links.',
        '**No fake PnL.** Do not post screenshots, statements or results you cannot substantiate. Do not present demo or simulated results as live.',
        '**No fabricated track records.** Do not claim verified performance you do not have. If asked for verification, either provide it or retract the claim.',
        '**No spam or flooding.** One idea, one post. No repeated pings, no wall-of-text dumps, no chart spam.',
        '**No harassment.** No personal attacks, slurs, targeted pile-ons or bad-faith provocation.',
        '**No manipulation.** No coordinated pumping, no talking your book without disclosing it, no engineering hype around a position.',
        '**Respect different approaches.** Discretionary, systematic, intraday, swing, futures, FX, crypto, equities — all legitimate. Method snobbery is not.',
        '**Debate ideas, not people.** Attack the reasoning, the data or the sample. Never the person holding it.',
        '**Back your claims.** If you assert an edge, be ready to state the sample size, the period, the market regime and what would invalidate it.',
        '**Educational discussion is encouraged.** Questions are welcome at every level. Nobody is mocked for not knowing something.',
        '**English in the main server.** {{#italia}} is the place for Italian.',
        '**No DM soliciting.** Do not DM members with offers, mentorship pitches or investment propositions. Report it in {{#tickets}}.',
    ],
    enforcement: 'Breaking these results in a warning, a timeout, a removal or a ban depending on severity and intent. ' +
        'Moderation decisions are logged. If you think one was wrong, open it with staff calmly.',
};
/** Label and text of the button that promotes New Member to Member. */
exports.VERIFICATION = {
    buttonLabel: 'I have read and accept the rules',
    /** Component custom_id — changing this breaks previously published buttons. */
    customId: 'desk:verify:accept',
    // Not run through the mention resolver: this is a direct interaction reply,
    // not a published embed, so it stays plain text.
    success: 'Verified. You now have access to the full server.\n\n' +
        'Start in **general**, pick your roles in **roles**, then read **trading-floor** and **the-lab** before posting in them.',
    alreadyVerified: 'You are already verified — you have full access.',
};
//# sourceMappingURL=content.js.map