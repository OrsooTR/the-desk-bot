/**
 * Moderation policy.
 *
 * Two layers, deliberately separate:
 *
 *   FRONT END  — Discord AutoMod rules, defined in AUTOMOD_RULES below. These
 *                run on Discord's side and block a message before it is ever
 *                posted. Nothing reaches the server, and nothing depends on
 *                the bot being online.
 *
 *   BACK END   — the strike ladder, applied by the bot when a human moderator
 *                files a warning or AutoMod escalates. Points accumulate and
 *                decay; the ladder decides the consequence so that it is the
 *                same for everyone regardless of which moderator is on.
 *
 * Everything here is data. Changing the policy is an edit to this file.
 */

/** What a moderator can file, and what it costs. */
export interface OffenceDefinition {
  key: string;
  label: string;
  /** Strike points added to the member's record. */
  points: number;
  description: string;
  /**
   * Bypass the ladder entirely. Reserved for conduct where a first offence is
   * already the last one — there is no warning ladder for a scam attempt.
   */
  immediate?: 'kick' | 'ban';
}

export const OFFENCES: OffenceDefinition[] = [
  {
    key: 'spam',
    label: 'Spam / flooding',
    points: 1,
    description: 'Repeated messages, wall-of-text dumps, chart spam, repeated pings.',
  },
  {
    key: 'unknown-link',
    label: 'Unknown or shortened link',
    points: 1,
    description: 'Shorteners, IP loggers, or links posted with no explanation.',
  },
  {
    key: 'guarantees',
    label: 'Guaranteed-returns claim',
    points: 1,
    description: '"Risk free", "guaranteed profit", "never loses". Against rule 1.',
  },
  {
    key: 'promotion',
    label: 'Unsolicited promotion',
    points: 2,
    description: 'Advertising a channel, course, group, bot or product without permission.',
  },
  {
    key: 'referral',
    label: 'Referral spam',
    points: 2,
    description: 'Broker, prop-firm or exchange referral links.',
  },
  {
    key: 'fake-pnl',
    label: 'Fake or unverifiable PnL',
    points: 2,
    description: 'Fabricated results, or demo results presented as live.',
  },
  {
    key: 'harassment',
    label: 'Harassment',
    points: 2,
    description: 'Personal attacks, targeted pile-ons, bad-faith provocation.',
  },
  {
    key: 'nsfw',
    label: 'NSFW content',
    points: 3,
    description: 'Sexual or graphic content. There is no channel for it here.',
  },
  {
    key: 'dm-soliciting',
    label: 'DM soliciting',
    points: 3,
    description: 'Cold-DMing members with offers, mentorship pitches or investment propositions.',
  },
  {
    key: 'scam',
    label: 'Scam or fraud attempt',
    points: 10,
    description: 'Phishing, fake giveaways, impersonation, investment fraud.',
    immediate: 'ban',
  },
  {
    key: 'hate',
    label: 'Racism or hate speech',
    points: 10,
    description: 'Slurs, racial abuse, or hatred directed at a protected group.',
    immediate: 'ban',
  },
  {
    key: 'other',
    label: 'Other rule violation',
    points: 1,
    description: 'Anything else in the rules. State it in the reason.',
  },
];

export function findOffence(key: string): OffenceDefinition | undefined {
  return OFFENCES.find((offence) => offence.key === key);
}

/* ────────────────────────────────────────────────────────────
 * The strike ladder
 * ──────────────────────────────────────────────────────────── */

export type LadderAction =
  | { type: 'warn' }
  | { type: 'timeout'; minutes: number }
  | { type: 'kick' }
  | { type: 'ban' };

export interface LadderStep {
  /** Applies once the member's active points reach this total. */
  atPoints: number;
  action: LadderAction;
  /** Shown to the member and written to the case record. */
  summary: string;
}

/**
 * Read highest-first: the last step whose threshold is met wins.
 * Timeouts before removal, and removal before a ban — a member who is going
 * to correct course gets several chances to notice.
 */
export const LADDER: LadderStep[] = [
  { atPoints: 1, action: { type: 'warn' }, summary: 'Formal warning' },
  { atPoints: 2, action: { type: 'timeout', minutes: 60 }, summary: '1 hour timeout' },
  { atPoints: 3, action: { type: 'timeout', minutes: 60 * 24 }, summary: '24 hour timeout' },
  { atPoints: 5, action: { type: 'timeout', minutes: 60 * 24 * 7 }, summary: '7 day timeout' },
  { atPoints: 7, action: { type: 'ban' }, summary: 'Ban' },
];

/**
 * Strikes stop counting after this long. People change, and a policy with no
 * expiry eventually bans someone for a bad week two years ago.
 */
export const STRIKE_DECAY_DAYS = 120;

export function resolveLadder(points: number): LadderStep | null {
  let matched: LadderStep | null = null;
  for (const step of LADDER) if (points >= step.atPoints) matched = step;
  return matched;
}

/* ────────────────────────────────────────────────────────────
 * AutoMod — the front-end filter
 *
 * These are provisioned as native Discord AutoMod rules by `/setup`. They act
 * before a message is delivered, they cost nothing at runtime, and they keep
 * working when the bot is offline.
 * ──────────────────────────────────────────────────────────── */

export type AutoModRuleKind = 'keyword' | 'spam' | 'mention-spam' | 'preset';

/** Discord's own maintained word lists. */
export type AutoModPreset = 'slurs' | 'sexual' | 'profanity';

export interface AutoModRuleDefinition {
  /** Stable key. The rule is matched by name, so keep `name` stable too. */
  key: string;
  name: string;
  kind: AutoModRuleKind;
  /** Literal phrases. `*` is a wildcard: `*free nitro*` matches inside a sentence. */
  keywords?: string[];
  /** Rust-flavour regular expressions, used only where a wildcard cannot do it. */
  regexPatterns?: string[];
  /**
   * Which of Discord's maintained lists to enable. Preset rules only.
   * Discord permits exactly ONE preset rule per server, so every list you want
   * has to live in this one rule.
   */
  presets?: AutoModPreset[];
  /** Phrases that override a match — legitimate uses of a blocked word. */
  allowList?: string[];
  /** Max unique mentions per message. Mention-spam rules only. */
  mentionLimit?: number;
  /** Shown to the member whose message was blocked. */
  blockMessage: string;
  /** Also time the member out for this many seconds. */
  timeoutSeconds?: number;
  /** Blueprint channel keys this rule does not apply in. */
  exemptChannelKeys?: string[];
}

export const AUTOMOD_RULES: AutoModRuleDefinition[] = [
  {
    key: 'scam',
    name: 'THE DESK — Scams and phishing',
    kind: 'keyword',
    keywords: [
      '*free nitro*',
      '*nitro giveaway*',
      '*discord.gift*',
      '*steamcommunity.com/gift*',
      '*claim your prize*',
      '*claim your reward*',
      '*claim your airdrop*',
      '*double your btc*',
      '*double your eth*',
      '*double your crypto*',
      '*double your money*',
      '*send me * and i will send back*',
      '*guaranteed profit*',
      '*guaranteed returns*',
      '*guaranteed roi*',
      '*risk free profit*',
      '*100% win rate*',
      '*recover your lost funds*',
      '*recovery expert*',
      '*dm me to invest*',
      '*dm me to earn*',
      '*i can trade for you*',
      '*copy my trades*',
      '*account manager*',
      '*seed phrase*',
      '*wallet validation*',
      '*connect your wallet*',
    ],
    blockMessage:
      'Blocked. That phrasing matches the pattern of a scam or a guaranteed-returns claim, both of which are against the rules of THE DESK. If this was a genuine message, open a ticket.',
    timeoutSeconds: 3600,
  },
  {
    key: 'suspicious-links',
    name: 'THE DESK — Shorteners and loggers',
    kind: 'keyword',
    keywords: [
      '*bit.ly/*',
      '*tinyurl.com/*',
      '*cutt.ly/*',
      '*is.gd/*',
      '*rb.gy/*',
      '*shorturl.at/*',
      '*t.ly/*',
      '*grabify.link*',
      '*iplogger.org*',
      '*iplogger.com*',
      '*blasze.tk*',
      '*yip.su*',
      '*2no.co*',
    ],
    blockMessage:
      'Blocked. Shortened links hide their destination and IP loggers harvest your address, so neither is allowed here. Post the full URL instead.',
  },
  {
    key: 'invites',
    name: 'THE DESK — Server invites',
    kind: 'keyword',
    keywords: ['*discord.gg/*', '*discord.com/invite/*', '*discordapp.com/invite/*'],
    blockMessage:
      'Blocked. Server invites are not allowed without staff permission. Ask in a ticket first.',
    exemptChannelKeys: ['staff', 'moderation'],
  },
  {
    // One rule, both lists: Discord permits exactly one preset rule per server.
    // Profanity is deliberately left off — traders swear, and a filter that
    // fires on ordinary frustration trains people to ignore the filter.
    key: 'preset',
    name: 'THE DESK — Hate speech and sexual content',
    kind: 'preset',
    presets: ['slurs', 'sexual'],
    blockMessage:
      'Blocked. Slurs and sexual content have no place here. Hate speech is an immediate ban, not a warning.',
    // No timeout: Discord rejects the timeout action on preset rules. The
    // consequence is applied by a moderator instead — `hate` is an immediate
    // ban in the offence table above, which is a harder line than a timeout.
  },
  {
    key: 'spam',
    name: 'THE DESK — Spam',
    kind: 'spam',
    blockMessage: 'Blocked as spam.',
  },
  {
    key: 'mention-spam',
    name: 'THE DESK — Mass mentions',
    kind: 'mention-spam',
    mentionLimit: 6,
    blockMessage: 'Blocked. That is too many mentions in one message.',
    timeoutSeconds: 600,
  },
];
