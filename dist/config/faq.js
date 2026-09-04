"use strict";
/**
 * The FAQ. Published as pinned embeds in #faq and searchable with /faq.
 *
 * Written to answer the question and then stop. If an answer needs three
 * paragraphs it probably belongs in #lessons instead.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAQ = void 0;
exports.faqSections = faqSections;
exports.findFaq = findFaq;
exports.searchFaq = searchFaq;
exports.FAQ = [
    /* ── Getting in ─────────────────────────────────────────── */
    {
        key: 'access',
        section: 'Getting started',
        question: 'I can only see #welcome and #rules. Why?',
        answer: 'You have not verified yet. Read the rules, then press **I have read and accept the rules** at the bottom of #rules. The rest of the server opens immediately. If the button does nothing, the bot is briefly offline — open a ticket and a moderator will verify you by hand.',
    },
    {
        key: 'language',
        section: 'Getting started',
        question: 'What language should I write in?',
        answer: 'English everywhere, except the **ITALIA** category, which is for Italian. Educational material stays in English so it is not split in two. If you want to discuss an English lesson in Italian, do it in #trading-italia.',
    },
    {
        key: 'start',
        section: 'Getting started',
        question: 'Where do I start?',
        answer: 'Introduce yourself in #general. Read #trading-floor and #research-lab before posting in them. Then post a trade in #trade-review using `/review` — reviewing your own losses honestly is the fastest way to be taken seriously here.',
    },
    /* ── What this is ───────────────────────────────────────── */
    {
        key: 'signals',
        section: 'What this is',
        question: 'Do you give signals or entries?',
        answer: 'No, and we never will. There are no signal channels and nobody here will tell you what to buy. Trade ideas are argued in #trading-floor with the reasoning attached, so you can judge them yourself.',
    },
    {
        key: 'cost',
        section: 'What this is',
        question: 'Is there a paid tier, a course, or a VIP group?',
        answer: 'No. Nothing is being sold to you, and anyone who tries to sell you something is breaking rule 2 — report it.',
    },
    {
        key: 'guarantees',
        section: 'What this is',
        question: 'Can I expect to make money here?',
        answer: 'Nobody can tell you that, and anyone who does is lying. This is a place to build a process and test it. Losing periods are a normal property of any strategy with positive expectancy, and a good week proves nothing on its own. Sample size decides.',
    },
    {
        key: 'advice',
        section: 'What this is',
        question: 'Is any of this financial advice?',
        answer: 'No. Nothing posted in this server is a recommendation to trade, and nobody here is your advisor. You are responsible for your own risk.',
    },
    /* ── Using the server ───────────────────────────────────── */
    {
        key: 'review',
        section: 'Using the server',
        question: 'How do I post a trade for review?',
        answer: 'Run `/review` with the instrument. It creates a structured post in #trade-review and opens a thread for you to fill in. Tag it — direction, session, and outcome — so it can be found again. The template exists to force the sequence: context before thesis, thesis before entry, risk before management.',
    },
    {
        key: 'forums',
        section: 'Using the server',
        question: 'Why are some channels forums instead of chats?',
        answer: '#trade-review, #research-lab, #lessons, #resources and #videos are forums because their content needs to be found again months later. Each post is a thread with tags you can filter on. A chat channel would bury all of it within a week.',
    },
    {
        key: 'events',
        section: 'Using the server',
        question: 'How do I know when sessions happen?',
        answer: 'Run `/event list`, or look at the events listed above the channel list — RSVP there and Discord will remind you. Announcements with agendas go in #events.',
    },
    {
        key: 'roles',
        section: 'Using the server',
        question: 'How do I get Researcher or Mentor?',
        answer: 'They are given, not applied for. **Researcher** goes to people who contribute real work to #research-lab. **Mentor** goes to people who consistently teach well. Both are earned by doing it in public for a while.',
    },
    /* ── Rules and moderation ───────────────────────────────── */
    {
        key: 'report',
        section: 'Rules and moderation',
        question: 'How do I report someone?',
        answer: 'Open a ticket in #open-a-ticket. Include a message link if you have one. Do not confront the person in the channel and do not start a pile-on — that is its own rule violation.',
    },
    {
        key: 'strikes',
        section: 'Rules and moderation',
        question: 'How does moderation work?',
        answer: 'Warnings carry points, and points determine the consequence: 1 is a warning, 2 is a one-hour timeout, 3 is a day, 5 is a week, 7 is a ban. Points expire after 120 days. Scams and hate speech skip the ladder and are an immediate ban.',
    },
    {
        key: 'blocked',
        section: 'Rules and moderation',
        question: 'My message was blocked automatically. Why?',
        answer: 'AutoMod blocks scam phrasing, guaranteed-returns claims, link shorteners, IP loggers, server invites, slurs and sexual content. If a legitimate message was caught, open a ticket and quote it — the filters get corrected.',
    },
    {
        key: 'dms',
        section: 'Rules and moderation',
        question: 'Someone sent me a DM offering to manage my money.',
        answer: 'That is a scam, every single time. Do not reply, do not send anything, screenshot it and open a ticket. Cold-DMing members with offers is an instant removal here.',
    },
];
function faqSections() {
    return [...new Set(exports.FAQ.map((entry) => entry.section))];
}
function findFaq(key) {
    return exports.FAQ.find((entry) => entry.key === key);
}
/** Naive substring search across question and answer, for /faq. */
function searchFaq(query) {
    const needle = query.trim().toLowerCase();
    if (!needle)
        return exports.FAQ;
    return exports.FAQ.filter((entry) => entry.question.toLowerCase().includes(needle) ||
        entry.answer.toLowerCase().includes(needle) ||
        entry.key.includes(needle));
}
//# sourceMappingURL=faq.js.map