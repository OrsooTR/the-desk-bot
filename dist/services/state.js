"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const state_1 = require("../types/state");
const env_1 = require("../config/env");
/**
 * Tiny persistent store mapping blueprint keys to Discord snowflakes.
 *
 * Deliberately a flat JSON file, not a database: the entire dataset is a few
 * dozen IDs, it must be readable by a human debugging a server at 2am, and it
 * must be trivially deletable. Losing it is not destructive — setup falls back
 * to matching resources by name.
 */
class StateStore {
    cache = null;
    get path() {
        return (0, node_path_1.resolve)(process.cwd(), (0, env_1.env)().stateFile);
    }
    read() {
        if (this.cache)
            return this.cache;
        if (!(0, node_fs_1.existsSync)(this.path)) {
            this.cache = structuredClone(state_1.EMPTY_STATE);
            return this.cache;
        }
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(this.path, 'utf8'));
            // Merge over the empty shape so a state file written by an older version
            // gains new keys instead of producing undefined property access.
            this.cache = { ...structuredClone(state_1.EMPTY_STATE), ...parsed, version: 1 };
            return this.cache;
        }
        catch {
            // A corrupt state file must never stop the bot from booting. Name-based
            // resolution still recovers the full server on the next /setup.
            this.cache = structuredClone(state_1.EMPTY_STATE);
            return this.cache;
        }
    }
    /** Apply a mutation and persist atomically. */
    update(mutate) {
        const state = this.read();
        mutate(state);
        this.write(state);
        return state;
    }
    /**
     * Persist, but never at the cost of the caller.
     *
     * Resolution helpers write here as a side effect of *reading* — that is how
     * the server heals itself after a rename. If persistence throws, that side
     * effect takes the whole lookup down with it, and a feature dies because a
     * cache could not be saved. It happened: a Railway volume mounted root-owned
     * under a non-root container turned every channel lookup into EACCES.
     *
     * So the in-memory cache is updated first and unconditionally, and a failed
     * write is reported once and swallowed. The bot then runs correctly with no
     * persistence, which is a mild degradation, rather than not running at all.
     */
    write(state) {
        this.cache = state;
        try {
            const dir = (0, node_path_1.dirname)(this.path);
            if (!(0, node_fs_1.existsSync)(dir))
                (0, node_fs_1.mkdirSync)(dir, { recursive: true });
            // Write-then-rename: a crash mid-write leaves the previous file intact.
            const temp = `${this.path}.tmp`;
            (0, node_fs_1.writeFileSync)(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
            (0, node_fs_1.renameSync)(temp, this.path);
            this.writable = true;
        }
        catch (error) {
            this.reportUnwritable(error);
        }
    }
    /** True once a write has succeeded; false after one has failed. */
    writable = true;
    warned = false;
    /**
     * Warn once, not on every lookup. `console` rather than the logger because
     * the logger resolves channels, which reads state — importing it here would
     * be circular, and a failure loop is the last thing this path needs.
     */
    reportUnwritable(error) {
        this.writable = false;
        if (this.warned)
            return;
        this.warned = true;
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[STATE] Cannot write ${this.path}: ${reason}\n` +
            '[STATE] Continuing without persistence. Resources are resolved by name ' +
            'instead, which works, but the mapping is rebuilt on every restart.\n' +
            '[STATE] On a container host this usually means the mounted volume is ' +
            'owned by root while the process runs as another user.');
    }
    /** Exposed so /server-status can report degraded persistence honestly. */
    get isPersistent() {
        return this.writable;
    }
    /* ── Convenience accessors ─────────────────────────────── */
    roleId(key) {
        return this.read().roles[key];
    }
    categoryId(key) {
        return this.read().categories[key];
    }
    channelId(key) {
        return this.read().channels[key];
    }
    message(key) {
        return this.read().messages[key];
    }
    rememberRole(key, id) {
        this.update((state) => {
            state.roles[key] = id;
        });
    }
    rememberCategory(key, id) {
        this.update((state) => {
            state.categories[key] = id;
        });
    }
    rememberChannel(key, id) {
        this.update((state) => {
            state.channels[key] = id;
        });
    }
    rememberMessage(key, channelId, messageId) {
        this.update((state) => {
            state.messages[key] = { channelId, messageId };
        });
    }
    recordSetup(guildId, userId) {
        this.update((state) => {
            state.guildId = guildId;
            state.lastSetupAt = new Date().toISOString();
            state.lastSetupBy = userId;
        });
    }
}
exports.state = new StateStore();
//# sourceMappingURL=state.js.map