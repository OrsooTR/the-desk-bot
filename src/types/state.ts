/**
 * Persisted mapping between blueprint keys and live Discord snowflakes.
 *
 * This is what makes setup safe under renames: we look a resource up by its
 * remembered ID first, and only fall back to name matching when the ID is gone.
 * Deleting this file is non-destructive — setup falls back to name matching.
 */
export interface StoredStrike {
  offenceKey: string;
  points: number;
  reason: string;
  moderatorId: string;
  at: string;
  automatic?: boolean;
}

export interface StoredTicket {
  /** The private thread the conversation happens in. */
  threadId: string;
  openerId: string;
  subject: string;
  openedAt: string;
  closedAt?: string;
  closedById?: string;
}

export interface BotState {
  version: 1;
  guildId: string | null;
  roles: Record<string, string>;
  categories: Record<string, string>;
  channels: Record<string, string>;
  /** Bot-authored messages we keep updated instead of reposting (key → ids). */
  messages: Record<string, { channelId: string; messageId: string }>;
  /** Moderation history, keyed by user id. */
  strikes: Record<string, StoredStrike[]>;
  /** Support tickets, keyed by thread id. */
  tickets: Record<string, StoredTicket>;
  /** Incrementing ticket number, so each one has a human-readable name. */
  ticketCounter: number;
  /**
   * Voice rooms the bot created on demand, keyed by channel id. Only channels
   * listed here are ever eligible for automatic deletion.
   */
  tempVoiceChannels: Record<string, { ownerId: string; createdAt: string }>;
  /** Pending funded-account verification requests, keyed by user id. */
  fundedRequests: Record<string, { threadId: string; requestedAt: string }>;
  lastSetupAt: string | null;
  lastSetupBy: string | null;
}

export const EMPTY_STATE: BotState = {
  version: 1,
  guildId: null,
  roles: {},
  categories: {},
  channels: {},
  messages: {},
  strikes: {},
  tickets: {},
  ticketCounter: 0,
  tempVoiceChannels: {},
  fundedRequests: {},
  lastSetupAt: null,
  lastSetupBy: null,
};
