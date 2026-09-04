"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countByKind = countByKind;
exports.countAll = countAll;
function countByKind(report, kind) {
    return tally(report.outcomes.filter((outcome) => outcome.kind === kind));
}
function countAll(report) {
    return tally(report.outcomes);
}
function tally(outcomes) {
    const counts = { created: 0, updated: 0, unchanged: 0, failed: 0 };
    for (const outcome of outcomes)
        counts[outcome.status] += 1;
    return counts;
}
//# sourceMappingURL=types.js.map