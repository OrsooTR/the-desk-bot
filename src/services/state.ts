import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EMPTY_STATE, type BotState } from '../types/state';
import { env } from '../config/env';

/**
 * Tiny persistent store mapping blueprint keys to Discord snowflakes.
 *
 * Deliberately a flat JSON file, not a database: the entire dataset is a few
 * dozen IDs, it must be readable by a human debugging a server at 2am, and it
 * must be trivially deletable. Losing it is not destructive — setup falls back
 * to matching resources by name.
 */
class StateStore {
  private cache: BotState | null = null;

  private get path(): string {
    return resolve(process.cwd(), env().stateFile);
  }

  read(): BotState {
    if (this.cache) return this.cache;

    if (!existsSync(this.path)) {
      this.cache = structuredClone(EMPTY_STATE);
      return this.cache;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<BotState>;
      // Merge over the empty shape so a state file written by an older version
      // gains new keys instead of producing undefined property access.
      this.cache = { ...structuredClone(EMPTY_STATE), ...parsed, version: 1 };
      return this.cache;
    } catch {
      // A corrupt state file must never stop the bot from booting. Name-based
      // resolution still recovers the full server on the next /setup.
      this.cache = structuredClone(EMPTY_STATE);
      return this.cache;
    }
  }

  /** Apply a mutation and persist atomically. */
  update(mutate: (state: BotState) => void): BotState {
    const state = this.read();
    mutate(state);
    this.write(state);
    return state;
  }

  private write(state: BotState): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Write-then-rename: a crash mid-write leaves the previous file intact.
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    renameSync(temp, this.path);
    this.cache = state;
  }

  /* ── Convenience accessors ─────────────────────────────── */

  roleId(key: string): string | undefined {
    return this.read().roles[key];
  }

  categoryId(key: string): string | undefined {
    return this.read().categories[key];
  }

  channelId(key: string): string | undefined {
    return this.read().channels[key];
  }

  message(key: string): { channelId: string; messageId: string } | undefined {
    return this.read().messages[key];
  }

  rememberRole(key: string, id: string): void {
    this.update((state) => {
      state.roles[key] = id;
    });
  }

  rememberCategory(key: string, id: string): void {
    this.update((state) => {
      state.categories[key] = id;
    });
  }

  rememberChannel(key: string, id: string): void {
    this.update((state) => {
      state.channels[key] = id;
    });
  }

  rememberMessage(key: string, channelId: string, messageId: string): void {
    this.update((state) => {
      state.messages[key] = { channelId, messageId };
    });
  }

  recordSetup(guildId: string, userId: string): void {
    this.update((state) => {
      state.guildId = guildId;
      state.lastSetupAt = new Date().toISOString();
      state.lastSetupBy = userId;
    });
  }
}

export const state = new StateStore();
