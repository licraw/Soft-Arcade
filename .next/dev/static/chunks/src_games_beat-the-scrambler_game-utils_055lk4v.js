(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/games/beat-the-scrambler/game-utils.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
(function() {
    function formatTime(totalSeconds) {
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;
        return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }
    function sanitizePlayerName(name) {
        return (name || "").trim().replace(/\s+/g, " ").slice(0, 12).toUpperCase();
    }
    function normalizeRuns(runs) {
        if (!Array.isArray(runs)) {
            return [];
        }
        return runs.filter(function(run) {
            return run && typeof run.name === "string";
        }).map(function(run) {
            return {
                name: sanitizePlayerName(run.name),
                moves: Number(run.moves) || 0,
                time: Number(run.time) || 0,
                completedAt: run.completedAt || new Date().toISOString()
            };
        });
    }
    function getUpdatedBest(previousBest, moveCount, timerSeconds) {
        let isNewBest = false;
        if (!previousBest || timerSeconds < previousBest.time) {
            isNewBest = true;
        }
        if (!previousBest || moveCount < previousBest.moves) {
            isNewBest = true;
        }
        if (!isNewBest) {
            return {
                isNewBest: false,
                best: previousBest
            };
        }
        return {
            isNewBest: true,
            best: {
                time: previousBest ? Math.min(previousBest.time, timerSeconds) : timerSeconds,
                moves: previousBest ? Math.min(previousBest.moves, moveCount) : moveCount
            }
        };
    }
    function createEmptyGrid(boardSize) {
        let grid = [];
        for(let y = 0; y < boardSize; y++){
            let row = [];
            for(let x = 0; x < boardSize; x++){
                row.push(null);
            }
            grid.push(row);
        }
        return grid;
    }
    function forEachCell(boardSize, iteratee) {
        for(let y = 0; y < boardSize; y++){
            for(let x = 0; x < boardSize; x++){
                iteratee(x, y);
            }
        }
    }
    function solvedTileValue(boardSize, x, y) {
        return y * boardSize + x + 1;
    }
    function isSolvedBoard(tiles, boardSize, readTileValue) {
        for(let y = 0; y < boardSize; y++){
            for(let x = 0; x < boardSize; x++){
                let expectedValue = solvedTileValue(boardSize, x, y);
                let tile = tiles[y][x];
                if (x === boardSize - 1 && y === boardSize - 1) {
                    if (tile !== null) {
                        return false;
                    }
                } else if (!tile || readTileValue(tile) !== expectedValue) {
                    return false;
                }
            }
        }
        return true;
    }
    function moveGap(boardSize, gapX, gapY, direction) {
        if (direction === "down" && gapY > 0) {
            return {
                tileX: gapX,
                tileY: gapY - 1,
                nextGapX: gapX,
                nextGapY: gapY - 1,
                axis: "y"
            };
        }
        if (direction === "up" && gapY < boardSize - 1) {
            return {
                tileX: gapX,
                tileY: gapY + 1,
                nextGapX: gapX,
                nextGapY: gapY + 1,
                axis: "y"
            };
        }
        if (direction === "right" && gapX > 0) {
            return {
                tileX: gapX - 1,
                tileY: gapY,
                nextGapX: gapX - 1,
                nextGapY: gapY,
                axis: "x"
            };
        }
        if (direction === "left" && gapX < boardSize - 1) {
            return {
                tileX: gapX + 1,
                tileY: gapY,
                nextGapX: gapX + 1,
                nextGapY: gapY,
                axis: "x"
            };
        }
        return null;
    }
    function randomDirection() {
        let r = Math.random();
        if (r < 0.25) {
            return "up";
        }
        if (r < 0.5) {
            return "down";
        }
        if (r < 0.75) {
            return "left";
        }
        return "right";
    }
    window.TileGameUtils = {
        createEmptyGrid: createEmptyGrid,
        forEachCell: forEachCell,
        formatTime: formatTime,
        getUpdatedBest: getUpdatedBest,
        isSolvedBoard: isSolvedBoard,
        moveGap: moveGap,
        normalizeRuns: normalizeRuns,
        randomDirection: randomDirection,
        sanitizePlayerName: sanitizePlayerName,
        solvedTileValue: solvedTileValue
    };
})();
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_games_beat-the-scrambler_game-utils_055lk4v.js.map