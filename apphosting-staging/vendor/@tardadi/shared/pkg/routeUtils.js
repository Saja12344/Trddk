"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.totalStationCount = totalStationCount;
/** Total stations = start + intermediate stops + end. */
function totalStationCount(intermediateStops, options) {
    const hasFrom = options?.hasFrom ?? true;
    const hasTo = options?.hasTo ?? true;
    return (intermediateStops + (hasFrom ? 1 : 0) + (hasTo ? 1 : 0));
}
