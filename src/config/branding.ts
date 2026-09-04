import { ActivityType } from 'discord.js';

/**
 * THE DESK visual identity.
 *
 * Minimal, dark, technical. Muted institutional tones — no neon, no gold,
 * no "get rich" palette. Colours are desaturated so embeds read as a research
 * terminal rather than a marketing funnel.
 */
export const COLORS = {
  /** Default accent — muted steel. */
  primary: 0x8d97a5,
  /** Successful operation. */
  success: 0x6f8f6f,
  /** Advisory / partial. */
  warning: 0xb59a5a,
  /** Failure / destructive. */
  danger: 0x9e5f5f,
  /** Low-emphasis structural embeds. */
  neutral: 0x5a6270,
} as const;

/**
 * How the bot appears in the member list.
 *
 * A bot is shown as online only while its process holds an open gateway
 * connection — presence cannot be set any other way, and it drops the moment
 * the process stops. This controls what the entry says while it is up.
 *
 * `status`: 'online' | 'idle' | 'dnd' | 'invisible'
 * `type`:   Playing | Streaming | Listening | Watching | Competing
 */
export const PRESENCE = {
  status: 'online',
  activity: {
    type: ActivityType.Watching,
    name: 'the tape',
  },
} as const;

export const BRAND = {
  name: 'THE DESK',
  tagline: 'Research. Process. Execution.',
  footer: 'THE DESK',
  /** Divider used in plain-text blocks. Deliberately typographic, not emoji. */
  rule: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
} as const;

/**
 * The operating principles. Referenced by the welcome message and /resources
 * so the culture is stated in exactly one place.
 */
export const PRINCIPLES: readonly string[] = [
  'Edge over hype.',
  'Process over prediction.',
  'Data over opinions.',
  'Execution over signals.',
  'Risk management over gambling.',
  'Research over guru worship.',
  'Long-term development over quick money.',
];

/** Questions the community is expected to ask. Used in the rules channel. */
export const HOUSE_QUESTIONS: readonly string[] = [
  '"Based on what sample?"',
  '"How many trades?"',
  '"What invalidates the thesis?"',
  '"What is the expectancy, not the win rate?"',
  '"Which market regime did this hold in?"',
];
