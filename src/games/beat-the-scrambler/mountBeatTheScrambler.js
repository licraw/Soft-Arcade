export function mountBeatTheScrambler() {
  let $ = window.jQuery || window.$;

  if (!$) {
    throw new Error("Beat the Scrambler requires jQuery.");
  }

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
  let leaderboardViewLevel = "medium";
  let pendingSubmission = null;
  let confirmAction = null;
  let touchStartX = null;
  let touchStartY = null;
  let MIN_SWIPE_DISTANCE = 24;
  let SCRAMBLER_OVERLAY_MS = getScramblerOverlayDuration("medium");
  let scrambleIntroId = null;
  let scrambleIntroActive = false;
  let SCRAMBLER_LINES = {
    menu: [
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

  function getScramblerOverlayDuration(levelName) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return 450;
    }

    switch (levelName) {
      case "easy":
        return 1550;
      case "hard":
        return 3200;
      case "medium":
      default:
        return 2350;
    }
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
    leaderboardViewLevel = currentLevelName;
    updateLeaderboardModal();
    showModal("#leaderboard-modal");
    refreshLeaderboard(leaderboardViewLevel);
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

  function getScramblerMarkup() {
    return '' +
      '<div class="scrambler-character-inner">' +
        '<svg viewBox="-28 0 176 120" role="presentation" focusable="false" aria-hidden="true">' +
          '<g class="scrambler-arms">' +
            '<g class="scrambler-arm scrambler-arm-left">' +
              '<path class="scrambler-limb" d="M29 59 C14 58, -6 68, -8 88 C-10 101, 4 108, 26 97"></path>' +
              '<path class="scrambler-hand" d="M20 96 L5 104 M20 93 L0 93 M21 90 L6 82"></path>' +
            '</g>' +
            '<g class="scrambler-arm scrambler-arm-right">' +
              '<path class="scrambler-limb" d="M91 59 C106 58, 126 68, 128 88 C130 101, 116 108, 94 97"></path>' +
              '<path class="scrambler-hand" d="M100 96 L115 104 M100 93 L120 93 M99 90 L114 82"></path>' +
            '</g>' +
          '</g>' +
          '<line class="scrambler-horn" x1="41" y1="22" x2="34" y2="12"></line>' +
          '<line class="scrambler-horn" x1="79" y1="22" x2="86" y2="12"></line>' +
          '<line class="scrambler-glitch-bar" x1="15" y1="42" x2="29" y2="42"></line>' +
          '<line class="scrambler-glitch-bar is-magenta" x1="89" y1="34" x2="104" y2="34"></line>' +
          '<line class="scrambler-glitch-bar" x1="92" y1="76" x2="107" y2="76"></line>' +
          '<line class="scrambler-glitch-bar is-magenta" x1="19" y1="84" x2="33" y2="84"></line>' +
          '<path class="scrambler-face" d="M60 16 L92 34 L102 60 L92 88 L60 104 L28 88 L18 60 L28 34 Z"></path>' +
          '<path class="scrambler-brow" d="M34 44 L53 39"></path>' +
          '<path class="scrambler-brow" d="M86 44 L67 39"></path>' +
          '<path class="scrambler-eye" d="M38 53 L52 47 L49 61 L34 62 Z"></path>' +
          '<path class="scrambler-eye" d="M82 51 L68 47 L71 60 L86 60 Z"></path>' +
          '<circle class="scrambler-pupil" cx="46" cy="55" r="2.4"></circle>' +
          '<circle class="scrambler-pupil" cx="75" cy="54" r="2.1"></circle>' +
          '<path class="scrambler-mouth" d="M42 75 C48 72, 52 81, 58 78 C65 74, 68 85, 78 72"></path>' +
          '<path class="scrambler-mouth-accent" d="M44 80 L50 78"></path>' +
        '</svg>' +
      '</div>';
  }

  function mountScramblerCharacters() {
    $("#scrambler-menu-character").html(getScramblerMarkup());
    $("#scrambler-overlay-character").html(getScramblerMarkup());
  }

  function clearScrambleIntroTimer() {
    if (scrambleIntroId !== null) {
      window.clearTimeout(scrambleIntroId);
      scrambleIntroId = null;
    }
  }

  function hideScramblerOverlay() {
    clearScrambleIntroTimer();
    scrambleIntroActive = false;
    $("#scrambler-overlay").removeClass("is-active").addClass("hidden");
  }

  function showScramblerOverlay() {
    let overlay = $("#scrambler-overlay");

    clearScrambleIntroTimer();
    scrambleIntroActive = true;
    overlay.css("--scrambler-overlay-duration", SCRAMBLER_OVERLAY_MS + "ms");
    overlay.removeClass("hidden is-active");
    void overlay[0].offsetWidth;
    overlay.addClass("is-active");

    scrambleIntroId = window.setTimeout(function() {
      hideScramblerOverlay();
    }, SCRAMBLER_OVERLAY_MS);
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
    hideScramblerOverlay();
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
    return leaderboardCache[leaderboardViewLevel] || [];
  }

  function updateLeaderboardLevelSwitcher() {
    $(".leaderboard-level-button").each(function() {
      let button = $(this);
      let isActive = button.data("level") === leaderboardViewLevel;

      button.toggleClass("is-active", isActive);
      button.attr("aria-pressed", isActive ? "true" : "false");
    });
  }

  function updateLeaderboardModal() {
    let runs = getCurrentLeaderboard();
    let state = leaderboardMeta[leaderboardViewLevel] || {};
    let list = $("#leaderboard-list");
    let emptyState = $("#leaderboard-empty");
    let tableWrap = $("#leaderboard-table-wrap");

    $("#leaderboard-level").text(LEVELS[leaderboardViewLevel].label);
    updateLeaderboardLevelSwitcher();
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

    if (levelName === leaderboardViewLevel) {
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

    if (levelName === leaderboardViewLevel) {
      updateLeaderboardModal();
    }
  }

  async function submitScore() {
    let playerName;
    let response;
    let payload;
    let submittedLevel;

    if (!pendingSubmission) {
      return;
    }

    submittedLevel = pendingSubmission.level;
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

      leaderboardCache[submittedLevel] = normalizeRuns(payload.scores);
      leaderboardMeta[submittedLevel] = { loading: false, error: "" };
      setScoreSubmitStatus("Score saved to the arcade board.", false);
      $("#submit-score-button").text("Saved");
      pendingSubmission = null;
    } catch (error) {
      $("#score-name").prop("disabled", false);
      $("#submit-score-button").prop("disabled", false).text("Save Score");
      setScoreSubmitStatus(error.message || "Score submission failed.", true);
    }

    if (!$("#leaderboard-modal").hasClass("hidden") && submittedLevel === leaderboardViewLevel) {
      updateLeaderboardModal();
    }
  }

  function showLeaderboardLevel(levelName) {
    if (!LEVELS[levelName]) {
      return;
    }

    leaderboardViewLevel = levelName;
    updateLeaderboardModal();
    refreshLeaderboard(levelName);
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
      .css("borderRadius", 0.035 * Math.min(tileWidth, tileHeight));

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
        tile.addClass(x % 2 ? "tile-cyan" : "tile-magenta");
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
    SCRAMBLER_OVERLAY_MS = getScramblerOverlayDuration(currentLevelName);
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
    showScramblerOverlay();
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

    if (!gameStarted || hasWon || scrambleIntroActive) {
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

    if (!gameStarted || hasWon || scrambleIntroActive || !$("#confirm-modal").hasClass("hidden")) {
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

    if (!gameStarted || hasWon || scrambleIntroActive || event.touches.length !== 1) {
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

    if (touchStartX === null || touchStartY === null || !gameStarted || hasWon || scrambleIntroActive) {
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

  function init() {
    mountScramblerCharacters();
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
    $(".leaderboard-level-button").click(function() {
      showLeaderboardLevel($(this).data("level"));
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
  }

  init();
}
