$(
function() {
  let utils = window.TileGameUtils;
  let TILE_GAP = 4;
  let STORAGE_KEY = "tileGamePersonalBests";
  let LEVELS = {
    easy: { size: 3, scrambleMoves: 12, label: "Easy 3x3" },
    medium: { size: 4, scrambleMoves: 100, label: "Medium 4x4" },
    hard: { size: 5, scrambleMoves: 180, label: "Hard 5x5" }
  };
  let LEADERBOARD_LIMIT = 10;
  let API_BASE_URL = getApiBaseUrl();

  let boardSize = LEVELS.medium.size;
  let scrambleMoves = LEVELS.medium.scrambleMoves;
  let currentLevelName = "medium";
  let tileWidth = 0;
  let tileHeight = 0;
  let boardTopOffset = 0;
  let columnEdges = [];
  let rowEdges = [];
  let tiles = [];
  let gapX = 0;
  let gapY = 0;
  let hasWon = false;
  let gameStarted = false;
  let moveCount = 0;
  let timerSeconds = 0;
  let timerId = null;
  let bests = loadBests();
  let leaderboardCache = {};
  let leaderboardMeta = {};
  let leaderboardRequestId = 0;
  let pendingSubmission = null;
  let confirmAction = null;
  let touchStartX = null;
  let touchStartY = null;
  let MIN_SWIPE_DISTANCE = 24;
  let SCRAMBLER_LINES = {
    menu: [
      "Let’s mix this up.",
      "Fix it. If you can.",
      "Order is overrated.",
      "Try not to embarrass yourself."
    ],
    confirm: [
      "Already?",
      "That was quick.",
      "Giving up so soon?"
    ],
    win: [
      "Not bad.",
      "You got lucky.",
      "Do it again.",
      "The Scrambler is annoyed.",
      "Ok... that was clean."
    ]
  };

  function getApiBaseUrl() {
    let config = window.TILE_GAME_CONFIG || {};
    let apiBaseUrl = typeof config.apiBaseUrl === "string" ? config.apiBaseUrl.trim() : "";

    if (!apiBaseUrl) {
      return "";
    }

    return apiBaseUrl.replace(/\/+$/, "");
  }

  function getScoresUrl(levelName) {
    let query = "?level=" + encodeURIComponent(levelName) + "&limit=" + LEADERBOARD_LIMIT;

    return API_BASE_URL + "/api/scores" + query;
  }

  function showModal(selector) {
    $(selector).removeClass("hidden");
  }

  function hideModal(selector) {
    $(selector).addClass("hidden");
  }

  function showWinModal() {
    showModal("#win-modal");
  }

  function hideWinModal() {
    hideModal("#win-modal");
  }

  function showStartMenu() {
    setScramblerLine("#scrambler-menu-line", SCRAMBLER_LINES.menu);
    showModal("#start-menu");
  }

  function hideStartMenu() {
    hideModal("#start-menu");
  }

  function showLeaderboardModal() {
    updateLeaderboardModal();
    showModal("#leaderboard-modal");
    refreshLeaderboard(currentLevelName);
  }

  function hideLeaderboardModal() {
    hideModal("#leaderboard-modal");
  }

  function showConfirmModal(options) {
    confirmAction = options.onConfirm || null;
    $("#confirm-title").text(options.title || "Are you sure?");
    $("#confirm-message").text(options.message || "");
    $("#confirm-accept").text(options.confirmLabel || "Confirm");
    setScramblerLine("#scrambler-confirm-line", SCRAMBLER_LINES.confirm);
    $("#scrambler-confirm-line").removeClass("hidden");
    showModal("#confirm-modal");
  }

  function hideConfirmModal() {
    confirmAction = null;
    $("#scrambler-confirm-line").addClass("hidden");
    hideModal("#confirm-modal");
  }

  function randomScramblerLine(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function setScramblerLine(selector, lines) {
    $(selector).text(randomScramblerLine(lines));
  }

  function resetScoreSubmissionUi() {
    pendingSubmission = null;
    $("#score-name").val("").prop("disabled", false);
    $("#submit-score-button").prop("disabled", false).text("Save Score");
    setScoreSubmitStatus("Enter a name to save your score.", false);
  }

  function returnToMainMenu() {
    gameStarted = false;
    hasWon = false;
    stopTimer();
    hideWinModal();
    hideLeaderboardModal();
    $("#win-best-badge").addClass("hidden");
    $("#board").addClass("hidden");
    $("#board .tile").remove();
    resetScoreSubmissionUi();
    setHudExpanded(false);
    showStartMenu();
  }

  function hasActiveRun() {
    return gameStarted && !hasWon && moveCount > 0;
  }

  function requestRestart() {
    if (!gameStarted) {
      return;
    }

    if (!hasActiveRun()) {
      startGame(currentLevelName);
      return;
    }

    showConfirmModal({
      title: "Restart Level?",
      message: "This will erase the current run and start the level over.",
      confirmLabel: "Restart",
      onConfirm: function() {
        startGame(currentLevelName);
      }
    });
  }

  function requestMainMenu() {
    if (!gameStarted || !hasActiveRun()) {
      returnToMainMenu();
      return;
    }

    showConfirmModal({
      title: "Exit To Menu?",
      message: "This will end the current run and send you back to level select.",
      confirmLabel: "Exit",
      onConfirm: returnToMainMenu
    });
  }

  function formatTime(totalSeconds) {
    return utils.formatTime(totalSeconds);
  }

  function formatCompletedAt(completedAt) {
    return new Date(completedAt).toLocaleString();
  }

  function loadBests() {
    let savedBests = localStorage.getItem(STORAGE_KEY);

    if (!savedBests) {
      return {};
    }

    try {
      return JSON.parse(savedBests) || {};
    } catch (error) {
      return {};
    }
  }

  function saveBests() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
  }

  function getCurrentBest() {
    return bests[currentLevelName] || null;
  }

  function formatBest(best) {
    if (!best) {
      return "No best yet";
    }

    return "Time: " + formatTime(best.time) + " | Moves: " + best.moves;
  }

  function updatePersonalBestDisplay() {
    let best = getCurrentBest();

    $("#personal-best-wrap").toggleClass("hidden", !best);

    if (best) {
      $("#personal-best").text(formatBest(best));
    }
  }

  function updateHud() {
    $("#current-level").text(LEVELS[currentLevelName].label);
    $("#hud-level-pill").text(LEVELS[currentLevelName].label);
    $("#move-count").text(moveCount);
    $("#timer").text(formatTime(timerSeconds));
    if (!gameStarted || moveCount === 0) {
      setScramblerLine("#scrambler-hud-line", SCRAMBLER_LINES.menu);
    }
    updatePersonalBestDisplay();
  }

  function setHudExpanded(isExpanded) {
    $("#hud").toggleClass("hud-expanded", !!isExpanded);
  }

  function resetStats() {
    moveCount = 0;
    timerSeconds = 0;
    stopTimer();
    updateHud();
  }

  function startTimer() {
    if (timerId !== null) {
      return;
    }

    timerId = window.setInterval(function() {
      timerSeconds += 1;
      updateHud();
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function updateWinStats() {
    $("#win-stats").text("Time: " + formatTime(timerSeconds) + " | Moves: " + moveCount);
  }

  function setScoreSubmitStatus(message, isError) {
    $("#score-submit-status")
      .text(message)
      .toggleClass("error", !!isError);
  }

  function setLeaderboardStatus(message, isError) {
    let status = $("#leaderboard-status");

    if (!message) {
      status.text("").addClass("hidden").removeClass("error");
      return;
    }

    status
      .text(message)
      .removeClass("hidden")
      .toggleClass("error", !!isError);
  }

  function sanitizePlayerName(name) {
    return utils.sanitizePlayerName(name);
  }

  function normalizeRuns(runs) {
    return utils.normalizeRuns(runs);
  }

  function getCurrentLeaderboard() {
    return leaderboardCache[currentLevelName] || [];
  }

  function updateLeaderboardModal() {
    let runs = getCurrentLeaderboard();
    let state = leaderboardMeta[currentLevelName] || {};
    let list = $("#leaderboard-list");
    let emptyState = $("#leaderboard-empty");
    let tableWrap = $("#leaderboard-table-wrap");

    $("#leaderboard-level").text(LEVELS[currentLevelName].label);
    list.empty();
    emptyState.addClass("hidden");
    tableWrap.addClass("hidden");

    if (state.loading) {
      setLeaderboardStatus("Loading scores...", false);
      return;
    }

    if (state.error) {
      setLeaderboardStatus(state.error, true);
    } else {
      setLeaderboardStatus("", false);
    }

    if (!runs.length) {
      emptyState.removeClass("hidden");
      return;
    }

    tableWrap.removeClass("hidden");

    $.each(runs, function(index, run) {
      list.append(
        $("<tr></tr>")
          .append($("<td></td>").text(index + 1))
          .append($("<td></td>").text(run.name))
          .append($("<td></td>").text(run.moves))
          .append($("<td></td>").text(formatTime(run.time)))
          .append($("<td></td>").text(formatCompletedAt(run.completedAt)))
      );
    });

    emptyState.toggleClass("hidden", list.children().length > 0);
  }

  async function refreshLeaderboard(levelName) {
    let requestId = ++leaderboardRequestId;

    leaderboardMeta[levelName] = { loading: true, error: "" };

    if (levelName === currentLevelName) {
      updateLeaderboardModal();
    }

    try {
      let response = await fetch(getScoresUrl(levelName), {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Leaderboard request failed.");
      }

      let payload = await response.json();

      if (requestId !== leaderboardRequestId) {
        return;
      }

      leaderboardCache[levelName] = normalizeRuns(payload.scores);
      leaderboardMeta[levelName] = { loading: false, error: "" };
    } catch (error) {
      if (requestId !== leaderboardRequestId) {
        return;
      }

      leaderboardMeta[levelName] = {
        loading: false,
        error: "Leaderboard unavailable right now."
      };
    }

    if (levelName === currentLevelName) {
      updateLeaderboardModal();
    }
  }

  async function submitScore() {
    let playerName;
    let response;
    let payload;

    if (!pendingSubmission) {
      return;
    }

    playerName = sanitizePlayerName($("#score-name").val());

    if (!playerName) {
      setScoreSubmitStatus("Enter a name with at least 1 character.", true);
      return;
    }

    $("#score-name").val(playerName).prop("disabled", true);
    $("#submit-score-button").prop("disabled", true).text("Saving...");
    setScoreSubmitStatus("Saving score...", false);

    try {
      response = await fetch(API_BASE_URL + "/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: playerName,
          level: pendingSubmission.level,
          moves: pendingSubmission.moves,
          time: pendingSubmission.time
        })
      });

      payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Score submission failed.");
      }

      leaderboardCache[pendingSubmission.level] = normalizeRuns(payload.scores);
      leaderboardMeta[pendingSubmission.level] = { loading: false, error: "" };
      setScoreSubmitStatus("Score saved to the arcade board.", false);
      $("#submit-score-button").text("Saved");
      pendingSubmission = null;
    } catch (error) {
      $("#score-name").prop("disabled", false);
      $("#submit-score-button").prop("disabled", false).text("Save Score");
      setScoreSubmitStatus(error.message || "Score submission failed.", true);
    }

    if (!$("#leaderboard-modal").hasClass("hidden")) {
      updateLeaderboardModal();
    }
  }

  function updateBestForCurrentLevel() {
    let nextBest = utils.getUpdatedBest(getCurrentBest(), moveCount, timerSeconds);

    if (nextBest.isNewBest) {
      bests[currentLevelName] = nextBest.best;
      saveBests();
    }

    return nextBest.isNewBest;
  }

  function updateWinBest(isNewBest) {
    $("#win-best").text("Personal Best: " + formatBest(getCurrentBest()));
    $("#win-best-badge").toggleClass("hidden", !isNewBest);
  }

  function tileLeft(x) {
    return columnEdges[x];
  }

  function tileTop(y) {
    return boardTopOffset + rowEdges[y];
  }

  function tileOuterWidth(x) {
    return columnEdges[x + 1] - columnEdges[x];
  }

  function tileOuterHeight(y) {
    return rowEdges[y + 1] - rowEdges[y];
  }

  function tileWidthAt(x) {
    return Math.max(0, tileOuterWidth(x) - TILE_GAP);
  }

  function tileHeightAt(y) {
    return Math.max(0, tileOuterHeight(y) - TILE_GAP);
  }

  function createEmptyBoard() {
    tiles = utils.createEmptyGrid(boardSize);
    gapX = boardSize - 1;
    gapY = boardSize - 1;
  }

  function moveDirection(direction) {
    let move = utils.moveGap(boardSize, gapX, gapY, direction);
    let tile;

    if (!move) {
      return false;
    }

    tile = tiles[move.tileY][move.tileX];
    tiles[gapY][gapX] = tile;

    if (move.axis === "y") {
      tile.data("y", gapY);
    } else {
      tile.data("x", gapX);
    }

    slideTile(tile);
    gapX = move.nextGapX;
    gapY = move.nextGapY;
    tiles[gapY][gapX] = null;
    return true;
  }

  function slideTile(tile, duration) {
    let x = tile.data("x");
    let y = tile.data("y");

    tile.animate({
      top: tileTop(y) + TILE_GAP / 2,
      left: tileLeft(x) + TILE_GAP / 2
    }, duration || 200);
  }

  function down() {
    return moveDirection("down");
  }

  function up() {
    return moveDirection("up");
  }

  function right() {
    return moveDirection("right");
  }

  function left() {
    return moveDirection("left");
  }

  function positionTiles() {
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        let tile = tiles[y][x];

        if (tile) {
          let tileX = tile.data("x");
          let tileY = tile.data("y");

          tile.css({
            top: tileTop(tileY) + TILE_GAP / 2,
            left: tileLeft(tileX) + TILE_GAP / 2,
            width: tileWidthAt(tileX),
            height: tileHeightAt(tileY),
            lineHeight: tileHeightAt(tileY) + "px"
          });
        }
      }
    }
  }

  function resize() {
    let boardWidth = $("#board").width();
    let boardHeight = $("#board").height();
    boardTopOffset = $("#hud").outerHeight() || 0;
    boardHeight = Math.max(0, boardHeight - boardTopOffset);

    tileWidth = boardWidth / boardSize;
    tileHeight = boardHeight / boardSize;
    columnEdges = [];
    rowEdges = [];

    for (let i = 0; i <= boardSize; i++) {
      columnEdges[i] = Math.round(boardWidth * i / boardSize);
      rowEdges[i] = Math.round(boardHeight * i / boardSize);
    }

    $(".tile")
      .css("fontSize", 0.8 * Math.min(tileWidth, tileHeight) + "px")
      .css("borderRadius", 0.05 * Math.min(tileWidth, tileHeight));

    positionTiles();
  }

  function initTiles() {
    $("#board .tile").remove();
    createEmptyBoard();

    utils.forEachCell(boardSize, function(x, y) {
      let value = utils.solvedTileValue(boardSize, x, y);

      if (value < boardSize * boardSize) {
        let tile = $('<div class="tile">' + value + "</div>");

        $("#board").append(tile);
        tile.data("x", x).data("y", y);
        tiles[y][x] = tile;

        if (x % 2) {
          tile.css("backgroundColor", "#539fe6");
        } else {
          tile.css("backgroundColor", "#ab4b7e");
        }
      }
    });
  }

  function scramble() {
    do {
      for (let i = 0; i < scrambleMoves; i++) {
        moveDirection(utils.randomDirection());
      }
    } while (isSolved());
  }

  function isSolved() {
    return utils.isSolvedBoard(tiles, boardSize, function(tile) {
      return parseInt(tile.text(), 10);
    });
  }

  function maybeShowWinModal() {
    if (!hasWon && isSolved()) {
      let isNewBest;

      hasWon = true;
      stopTimer();
      pendingSubmission = {
        level: currentLevelName,
        moves: moveCount,
        time: timerSeconds
      };
      isNewBest = updateBestForCurrentLevel();
      updateHud();
      updateWinStats();
      updateWinBest(isNewBest);
      setScramblerLine("#scrambler-win-line", SCRAMBLER_LINES.win);
      setScoreSubmitStatus("Enter a name to save your score.", false);
      $("#score-name").val("").prop("disabled", false);
      $("#submit-score-button").prop("disabled", false).text("Save Score");
      refreshLeaderboard(currentLevelName);
      showWinModal();
      $("#score-name").trigger("focus");
    }
  }

  function startGame(levelName) {
    let level = LEVELS[levelName] || LEVELS.medium;

    currentLevelName = LEVELS[levelName] ? levelName : "medium";
    boardSize = level.size;
    scrambleMoves = level.scrambleMoves;
    hasWon = false;
    gameStarted = true;

    hideWinModal();
    $("#win-best-badge").addClass("hidden");
    $("#win-best").text("Personal Best: " + formatBest(getCurrentBest()));
    hideStartMenu();
    $("#board").removeClass("hidden");
    resetScoreSubmissionUi();
    resetStats();
    setHudExpanded(false);

    initTiles();
    resize();
    scramble();
    positionTiles();
    refreshLeaderboard(currentLevelName);
  }

  function isTypingTarget(target) {
    let tagName = target && target.tagName ? target.tagName.toLowerCase() : "";

    return tagName === "input" || tagName === "textarea" || target.isContentEditable;
  }

  function keydown(event) {
    let moved = false;

    if (isTypingTarget(event.target)) {
      return;
    }

    if (!$("#confirm-modal").hasClass("hidden")) {
      if (event.which === 27) {
        hideConfirmModal();
      }
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    if (!gameStarted || hasWon) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    switch (event.which) {
      case 38:
        moved = up();
        break;
      case 37:
        moved = left();
        break;
      case 39:
        moved = right();
        break;
      case 40:
        moved = down();
        break;
      default:
        return;
    }

    if (moved) {
      if (moveCount === 0) {
        startTimer();
      }

      moveCount += 1;
      updateHud();
      maybeShowWinModal();
    }

    event.stopPropagation();
    event.preventDefault();
  }

  function completeMove(moved) {
    if (!moved) {
      return;
    }

    if (moveCount === 0) {
      startTimer();
    }

    moveCount += 1;
    updateHud();
    maybeShowWinModal();
  }

  function tryMove(direction) {
    let moved = false;

    if (!gameStarted || hasWon || !$("#confirm-modal").hasClass("hidden")) {
      return false;
    }

    switch (direction) {
      case "up":
        moved = up();
        break;
      case "left":
        moved = left();
        break;
      case "right":
        moved = right();
        break;
      case "down":
        moved = down();
        break;
      default:
        return false;
    }

    completeMove(moved);
    return moved;
  }

  function handleBoardTouchStart(event) {
    let touch;

    if (!gameStarted || hasWon || event.touches.length !== 1) {
      return;
    }

    touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function handleBoardTouchEnd(event) {
    let touch;
    let deltaX;
    let deltaY;

    if (touchStartX === null || touchStartY === null || !gameStarted || hasWon) {
      touchStartX = null;
      touchStartY = null;
      return;
    }

    touch = event.changedTouches[0];
    deltaX = touch.clientX - touchStartX;
    deltaY = touch.clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;

    if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE && Math.abs(deltaY) < MIN_SWIPE_DISTANCE) {
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      tryMove(deltaX > 0 ? "right" : "left");
    } else {
      tryMove(deltaY > 0 ? "down" : "up");
    }

    event.preventDefault();
  }

  return function() {
    $(window).resize(function() {
      if (gameStarted) {
        resize();
      }
    });

    $(document).keydown(keydown);
    $("#board").on("touchstart", handleBoardTouchStart);
    $("#board").on("touchend", handleBoardTouchEnd);
    $("#win-modal-close").click(returnToMainMenu);
    $("#win-modal").click(function(event) {
      if (event.target === this) {
        returnToMainMenu();
      }
    });
    $("#submit-score-button").click(submitScore);
    $("#score-name").on("keydown", function(event) {
      if (event.which === 13) {
        event.preventDefault();
        submitScore();
      }
    });
    $("#leaderboard-button").click(showLeaderboardModal);
    $("#menu-leaderboard-button").click(showLeaderboardModal);
    $("#leaderboard-close").click(hideLeaderboardModal);
    $("#leaderboard-modal").click(function(event) {
      if (event.target === this) {
        hideLeaderboardModal();
      }
    });
    $("#restart-button").click(requestRestart);
    $("#main-menu-button").click(requestMainMenu);
    $("#hud-toggle-button").click(function() {
      setHudExpanded(!$("#hud").hasClass("hud-expanded"));
    });
    $("#confirm-cancel").click(hideConfirmModal);
    $("#confirm-accept").click(function() {
      let action = confirmAction;

      hideConfirmModal();

      if (action) {
        action();
      }
    });
    $("#confirm-modal").click(function(event) {
      if (event.target === this) {
        hideConfirmModal();
      }
    });
    $(".level-button").click(function() {
      startGame($(this).data("level"));
    });

    $("#board").addClass("hidden");
    updateHud();
    showStartMenu();
  };
}()
);
