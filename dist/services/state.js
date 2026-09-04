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
    write(state) {
        const dir = (0, node_path_1.dirname)(this.path);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        // Write-then-rename: a crash mid-write leaves the previous file intact.
        const temp = `${this.path}.tmp`;
        (0, node_fs_1.writeFileSync)(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
        (0, node_fs_1.renameSync)(temp, this.path);
        this.cache = state;
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