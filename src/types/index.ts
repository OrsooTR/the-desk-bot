import type { PermissionFlagsBits } from 'discord.js';

/**
 * Every permission name discord.js exposes. Using the key union (rather than
 * raw bigints) keeps `config/server.ts` readable and typo-proof.
 */
export type PermissionKey = keyof typeof PermissionFlagsBits;

/** Stable identifiers for the roles THE DESK provisions. */
export type RoleKey =
  | 'founder'
  | 'admin'
  | 'moderator'
  | 'mentor'
  | 'researcher'
  | 'member'
  | 'newMember'
  | 'bot';

/**
 * Who a channel permission overwrite applies to.
 * - `everyone` → the @everyone role
 * - `role`     → one of our managed roles, resolved at runtime
 * - `self`     → the bot's own user (used so it can always write to #bot-logs)
 */
export type OverwriteTarget =
  | { kind: 'everyone' }
  | { kind: 'role'; role: RoleKey }
  | { kind: 'self' };

export interface OverwriteSpec {
  target: OverwriteTarget;
  allow?: PermissionKey[];
  deny?: PermissionKey[];
}

export interface RoleDefinition {
  /** Core roles use a RoleKey; self-assignable roles use a free-form key. */
  key: string;
  name: string;
  /** Omit for Discord's default (no colour). Keep the palette restrained. */
  color?: number;
  /** Show separately in the member list. */
  hoist: boolean;
  mentionable: boolean;
  /** Guild-wide permissions. Channel access is granted via overwrites. */
  permissions: PermissionKey[];
  /** Documentation only — surfaced by /server-status. */
  purpose: string;
}

/**
 * The Discord channel types the blueprint provisions.
 *
 * - `text`         standard chat
 * - `announcement` broadcast channel; other servers can follow it
 * - `forum`        post-per-topic with tags — the right shape for reviews,
 *                  research and lessons, which are threads that need to be
 *                  found again months later
 * - `media`        forum with a gallery layout, for visual material
 * - `voice`        standard voice room
 * - `stage`        hosted talk: an audience that listens and requests to speak
 */
export type ManagedChannelType = 'text' | 'announcement' | 'forum' | 'media' | 'voice' | 'stage';

export interface ChannelDefinition {
  /** Stable key used in state.json. Never change it once deployed. */
  key: string;
  name: string;
  type: ManagedChannelType;
  /** Topic, or post guidelines on a forum. Not supported on voice/stage. */
  topic?: string;
  /** Slowmode in seconds (text-like channels). */
  rateLimitPerUser?: number;
  /** Max concurrent users (voice/stage, 0 = unlimited). */
  userLimit?: number;
  /**
   * Forum/media post tags. Setup only ever ADDS missing tags: removing one
   * would orphan every post already filed under it.
   */
  tags?: string[];
  /** Forum display: a list of posts, or a gallery of their first image. */
  layout?: 'list' | 'gallery';
  /**
   * Turns a voice channel into a "join to create" hub: joining it spawns a
   * temporary room and moves the member into it. The hub itself is never
   * somewhere anyone actually talks.
   */
  spawner?: VoiceSpawner;
  /** Overwrites layered on top of the parent category's. */
  overwrites?: OverwriteSpec[];
}

export interface CategoryDefinition {
  key: string;
  name: string;
  /** Documentation only — surfaced by /server-status. */
  purpose: string;
  overwrites: OverwriteSpec[];
  channels: ChannelDefinition[];
}

export interface ServerBlueprint {
  /** Ordered high → low. Index 0 sits at the top of the role list. */
  roles: RoleDefinition[];
  /**
   * Cosmetic, self-assignable roles: no permissions, not hoisted, chosen by
   * members from the roles channel. Kept in a separate list from `roles` so
   * they can never take part in a permission or hierarchy decision.
   */
  selfRoles: RoleDefinition[];
  /** Permissions applied to the @everyone role itself. */
  everyonePermissions: PermissionKey[];
  /** Ordered top → bottom in the channel sidebar. */
  categories: CategoryDefinition[];
  /** Role auto-assigned on join. */
  joinRole: RoleKey;
  /** Role granted when a member accepts the rules. */
  verifiedRole: RoleKey;
  /** Channel key used for bot logging. */
  logChannelKey: string;
  /** Channel key where the welcome text lives. */
  welcomeChannelKey: string;
  /** Channel key where the rules + verification button live. */
  rulesChannelKey: string;
  /** Channel key where event announcements are posted. */
  eventsChannelKey: string;
  /** Channel key suggested by /review. */
  tradeReviewChannelKey: string;
  /** Channel holding the FAQ. */
  faqChannelKey: string;
  /** Channel holding the ticket panel; tickets are private threads inside it. */
  ticketChannelKey: string;
  /** Channel where moderation cases are recorded. */
  moderationChannelKey: string;
  /** Channel holding the self-assignable role menus. */
  rolesChannelKey: string;
  /** Channel the daily market digest is posted to. */
  newsChannelKey: string;
}

/**
 * Configuration for a join-to-create voice hub.
 *
 * Rooms created this way are temporary: the bot deletes each one the moment it
 * empties. That deletion is the single exception to "the bot never deletes" —
 * it only ever removes a channel it created itself, seconds earlier, and the
 * anti-nuke watcher ignores its own actions.
 */
export interface VoiceSpawner {
  /** Name of the created room. `{user}` is replaced with the creator. */
  namePattern: string;
  /** Seats in the created room. 0 = unlimited. */
  userLimit?: number;
  /**
   * Only these roles may create a room here. The hub also denies Connect to
   * everyone else, so the restriction is enforced by Discord, not just by us.
   */
  restrictTo?: RoleKey[];
  /** Created rooms are visible only to `restrictTo` and the creator. */
  private?: boolean;
}
