"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandRegistry = void 0;
class CommandRegistry {
    commands = new Map();
    constructor(commands) {
        for (const command of commands) {
            if (this.commands.has(command.data.name)) {
                throw new Error(`Duplicate command name registered: ${command.data.name}`);
            }
            this.commands.set(command.data.name, command);
        }
    }
    get(name) {
        return this.commands.get(name);
    }
    all() {
        return [...this.commands.values()];
    }
    /** Payload for Discord's bulk command registration endpoint. */
    toJSON() {
        return this.all().map((command) => command.data.toJSON());
    }
}
exports.CommandRegistry = CommandRegistry;
//# sourceMappingURL=command.js.map