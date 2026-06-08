import { getArcadeName, normalizeArcadeName, setArcadeName } from "@/lib/arcadeName";

export function mountBeatTheScrambler(posthog) {
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
  let scoreRunId = 0;
  let confirmAction = null;
  let touchStartX = null;
  let touchStartY = null;
  let MIN_SWIPE_DISTANCE = 24;
  let MOBILE_PLAY_BREAKPOINT = "(max-width: 720px)";
  let SCRAMBLER_OVERLAY_MS = getScramblerOverlayDuration("medium");
  let scrambleIntroId = null;
  let scrambleIntroActive = false;
  let mobilePlayMode = false;
  let mobilePaused = false;
  let mobileScrollLock = null;
  let EVENT_NAMESPACE = ".beatTheScrambler";
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
      "The Scrambler wants a rematch.",
      "You fixed it. Barely.",
      "Suspiciously tidy.",
      "The tiles are back where they belong.",
      "Not bad.",
      "Order restored. For now.",
      "The Scrambler is recalibrating."
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
    showScoreEntryState();
  }

  function showScoreEntryState() {
    let arcadeName = loadLastPlayerName();

    $("#win-modal").removeClass("is-score-saved");

    if (pendingSubmission && arcadeName) {
      showAutoSaveState(arcadeName);
      submitScore(arcadeName);
      return;
    }

    showNamePromptState("Enter a name to save your first score.", false);
  }

  function showNamePromptState(message, isError) {
    $("#score-name-label").removeClass("hidden");
    $("#score-name").removeClass("hidden").val(loadLastPlayerName()).prop("disabled", false);
    $("#submit-score-button").removeClass("hidden").prop("disabled", false).text(pendingSubmission ? "Save Score" : "Save Name");
    $("#change-name-button").addClass("hidden").prop("disabled", false);
    $("#play-again-button").removeClass("hidden");
    setScoreSubmitStatus(message || "Enter a name to save your score.", !!isError, false);
  }

  function showAutoSaveState(playerName) {
    $("#score-name-label").addClass("hidden");
    $("#score-name").addClass("hidden").val(playerName).prop("disabled", true);
    $("#submit-score-button").addClass("hidden").prop("disabled", true).text("Saving...");
    $("#change-name-button").removeClass("hidden").prop("disabled", true);
    $("#play-again-button").removeClass("hidden");
    setScoreSubmitStatus("Saving score...", false, false);
  }

  function playAgain() {
    startGame(currentLevelName, true);
  }

  function requestWinModalClose() {
    if (!pendingSubmission || pendingSubmission.submissionStarted) {
      returnToMainMenu();
      return;
    }

    showConfirmModal({
      title: "Leave Without Saving?",
      message: "Your completed run has not been saved to the leaderboard.",
      confirmLabel: "Leave",
      onConfirm: returnToMainMenu
    });
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
    exitMobilePlayMode();
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
        startGame(currentLevelName, true);
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

  function loadLastPlayerName() {
    return getArcadeName();
  }

  function saveLastPlayerName(playerName) {
    return setArcadeName(playerName);
  }

  function persistScoreNameInput() {
    let playerName = sanitizePlayerName($("#score-name").val());

    if (playerName) {
      saveLastPlayerName(playerName);
    }
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

  function isMobileLayout() {
    return window.matchMedia(MOBILE_PLAY_BREAKPOINT).matches;
  }

  function getGameShell() {
    return $('[data-game-shell="beat-the-scrambler"]');
  }

  function focusMobileGame() {
    let shell;
    let shellRect;
    let viewportPadding;
    let bottomVisibilityBias;
    let shellTop;
    let viewportHeight;
    let availableHeight;
    let centeredTop;
    let desiredTop;

    if (!isMobileLayout()) {
      return false;
    }

    shell = getGameShell()[0];

    if (!shell) {
      return false;
    }

    viewportPadding = 8;
    bottomVisibilityBias = 18;
    shellRect = shell.getBoundingClientRect();
    shellTop = shellRect.top + window.scrollY;
    viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    availableHeight = viewportHeight - viewportPadding * 2;
    centeredTop = (availableHeight - shellRect.height) / 2;
    desiredTop = shellRect.height <= availableHeight
      ? Math.max(viewportPadding, centeredTop - bottomVisibilityBias)
      : viewportPadding;

    window.scrollTo({
      top: Math.max(0, shellTop - desiredTop),
      behavior: "auto"
    });

    return true;
  }

  function setMobileScrollLocked(isLocked) {
    let body = document.body;
    let scrollY;

    if (!isLocked) {
      if (mobileScrollLock) {
        body.classList.remove("beat-scrambler-mobile-play-mode");
        body.style.position = mobileScrollLock.position;
        body.style.top = mobileScrollLock.top;
        body.style.width = mobileScrollLock.width;
        body.style.overflow = mobileScrollLock.overflow;
        window.scrollTo(0, mobileScrollLock.scrollY);
        mobileScrollLock = null;
      }
      return;
    }

    if (mobileScrollLock) {
      return;
    }

    scrollY = window.scrollY;
    mobileScrollLock = {
      scrollY: scrollY,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow
    };
    body.classList.add("beat-scrambler-mobile-play-mode");
    body.style.position = "fixed";
    body.style.top = "-" + scrollY + "px";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }

  function syncMobilePlayUi() {
    let isMobile = isMobileLayout();
    let isActiveRun = gameStarted && !hasWon;
    let showControls = mobilePlayMode && isMobile && isActiveRun;
    let lockScroll = showControls && !mobilePaused;
    let shell = getGameShell();

    $("#mobile-play-actions").toggleClass("is-active", showControls);
    $("#mobile-pause-button")
      .text(mobilePaused ? "Resume" : "Pause")
      .attr("aria-pressed", mobilePaused ? "true" : "false");

    if (showControls) {
      shell.attr("data-mobile-controls", "true");
    } else {
      shell.removeAttr("data-mobile-controls");
    }

    if (lockScroll) {
      shell.attr("data-mobile-play-mode", "true");
    } else {
      shell.removeAttr("data-mobile-play-mode");
    }

    setMobileScrollLocked(lockScroll);
  }

  function enterMobilePlayMode() {
    if (!isMobileLayout()) {
      mobilePlayMode = false;
      mobilePaused = false;
      syncMobilePlayUi();
      return false;
    }

    focusMobileGame();
    mobilePlayMode = true;
    mobilePaused = false;
    syncMobilePlayUi();
    return true;
  }

  function exitMobilePlayMode() {
    mobilePlayMode = false;
    mobilePaused = false;
    touchStartX = null;
    touchStartY = null;
    syncMobilePlayUi();
  }

  function pauseMobileGame() {
    if (!gameStarted || hasWon || !mobilePlayMode || mobilePaused) {
      return;
    }

    mobilePaused = true;
    touchStartX = null;
    touchStartY = null;
    stopTimer();
    syncMobilePlayUi();
  }

  function resumeMobileGame() {
    if (!gameStarted || hasWon || !mobilePlayMode || !mobilePaused) {
      return;
    }

    focusMobileGame();
    mobilePaused = false;
    if (moveCount > 0) {
      startTimer();
    }
    syncMobilePlayUi();
  }

  function toggleMobilePause() {
    if (mobilePaused) {
      resumeMobileGame();
      return;
    }

    pauseMobileGame();
  }

  function resetStats() {
    moveCount = 0;
    timerSeconds = 0;
    stopTimer();
    updateHud();
  }

  function startTimer() {
    if (timerId !== null || mobilePaused) {
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
    $("#win-stat-time").text(formatTime(timerSeconds));
    $("#win-stat-moves").text(moveCount);
    $("#win-stat-difficulty").text(LEVELS[currentLevelName].label.replace(/\s+\d+x\d+$/, ""));
  }

  function setScoreSubmitStatus(message, isError, isSuccess) {
    $("#score-submit-status")
      .text(message)
      .toggleClass("error", !!isError)
      .toggleClass("success", !!isSuccess);
  }

  function showScoreSavedState() {
    let playerName = loadLastPlayerName();

    $("#win-modal").addClass("is-score-saved");
    $("#score-name-label").addClass("hidden");
    $("#score-name").addClass("hidden").val(playerName).prop("disabled", true);
    $("#submit-score-button").addClass("hidden").prop("disabled", true).text("Saved");
    $("#change-name-button").removeClass("hidden").prop("disabled", false);
    $("#play-again-button").removeClass("hidden");
    setScoreSubmitStatus(playerName ? "Saved as " + playerName : "Score saved", false, true);
    $("#play-again-button").trigger("focus");
  }

  function showScoreFailedState() {
    $("#win-modal").removeClass("is-score-saved");
    $("#score-name-label").addClass("hidden");
    $("#score-name").addClass("hidden").prop("disabled", true);
    $("#submit-score-button").addClass("hidden").prop("disabled", true).text("Save Score");
    $("#change-name-button").removeClass("hidden").prop("disabled", false);
    $("#play-again-button").removeClass("hidden");
    setScoreSubmitStatus("Score could not be saved.", true, false);
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
    return normalizeArcadeName(name);
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
          .append($("<td></td>").attr("data-label", "Rank").text(index + 1))
          .append($("<td></td>").attr("data-label", "Name").text(run.name))
          .append($("<td></td>").attr("data-label", "Moves").text(run.moves))
          .append($("<td></td>").attr("data-label", "Time").text(formatTime(run.time)))
          .append($("<td></td>").attr("data-label", "Finished").text(formatCompletedAt(run.completedAt)))
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

  async function submitScore(playerNameOverride) {
    let playerName;
    let response;
    let payload;
    let submittedLevel;
    let submission;

    if (!pendingSubmission || pendingSubmission.submissionStarted) {
      return;
    }

    submission = pendingSubmission;
    submittedLevel = submission.level;
    playerName = sanitizePlayerName(playerNameOverride || $("#score-name").val());

    if (!playerName) {
      showNamePromptState("Enter a name with at least 1 character.", true);
      return;
    }

    submission.submissionStarted = true;
    $("#score-name").val(playerName);
    saveLastPlayerName(playerName);
    showAutoSaveState(playerName);
    $("#play-again-button").trigger("focus");
    posthog.capture("score_auto_save_started", {
      game: "beat-the-scrambler",
      difficulty: submittedLevel
    });

    try {
      response = await fetch(API_BASE_URL + "/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: playerName,
          level: submission.level,
          moves: submission.moves,
          time: submission.time
        })
      });

      payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Score submission failed.");
      }

      leaderboardCache[submittedLevel] = normalizeRuns(payload.scores);
      leaderboardMeta[submittedLevel] = { loading: false, error: "" };
      pendingSubmission = null;
      showScoreSavedState();

      posthog.capture("score_auto_save_success", {
        game: "beat-the-scrambler",
        difficulty: submittedLevel
      });
      posthog.capture("score_submitted", {
        game: "beat-the-scrambler",
        difficulty: submittedLevel
      });
    } catch (error) {
      pendingSubmission = null;
      showScoreFailedState();

      posthog.capture("score_auto_save_failed", {
        game: "beat-the-scrambler",
        difficulty: submittedLevel,
        error: error.message || "Score submission failed."
      });
      posthog.capture("score_submit_failed", {
        game: "beat-the-scrambler",
        difficulty: submittedLevel,
        error: error.message || "Score submission failed."
      });
    }

    if (!$("#leaderboard-modal").hasClass("hidden") && submittedLevel === leaderboardViewLevel) {
      updateLeaderboardModal();
    }
  }

  function saveArcadeNameChange() {
    let playerName;

    if (pendingSubmission && !pendingSubmission.submissionStarted) {
      submitScore();
      return;
    }

    playerName = sanitizePlayerName($("#score-name").val());

    if (!playerName) {
      showNamePromptState("Enter a name with at least 1 character.", true);
      return;
    }

    saveLastPlayerName(playerName);
    posthog.capture("arcade_name_set", { game: "beat-the-scrambler" });
    $("#score-name").val(playerName);
    $("#score-name-label").addClass("hidden");
    $("#score-name").addClass("hidden").prop("disabled", true);
    $("#submit-score-button").addClass("hidden").prop("disabled", true).text("Save Score");
    $("#change-name-button").removeClass("hidden").prop("disabled", false);
    $("#play-again-button").removeClass("hidden");
    setScoreSubmitStatus("Arcade name saved as " + playerName + ".", false, true);
  }

  function changeArcadeName() {
    showNamePromptState("Enter a new arcade name.", false);
    $("#score-name").trigger("focus");
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
        id: ++scoreRunId,
        level: currentLevelName,
        moves: moveCount,
        time: timerSeconds,
        submissionStarted: false
      };
      isNewBest = updateBestForCurrentLevel();
      updateHud();
      updateWinStats();
      updateWinBest(isNewBest);
      setScramblerLine("#scrambler-win-line", SCRAMBLER_LINES.win);
      showScoreEntryState();
      refreshLeaderboard(currentLevelName);
      syncMobilePlayUi();
      showWinModal();
      if (!loadLastPlayerName()) {
        $("#score-name").trigger("focus");
      }

      posthog.capture("puzzle_solved", {
        game: "beat-the-scrambler",
        difficulty: currentLevelName,
        board_size: boardSize,
        moves: moveCount,
        elapsed_seconds: timerSeconds,
        is_new_best: isNewBest
      });
    }
  }

  function startGame(levelName, isRestart) {
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
    enterMobilePlayMode();

    if (isRestart) {
      posthog.capture("game_restarted", {
        game: "beat-the-scrambler",
        difficulty: currentLevelName
      });
    } else {
      posthog.capture("game_started", {
        game: "beat-the-scrambler",
        difficulty: currentLevelName,
        board_size: boardSize
      });
    }
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

    if (!gameStarted || hasWon || mobilePaused || scrambleIntroActive) {
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

    if (!gameStarted || hasWon || mobilePaused || scrambleIntroActive || !$("#confirm-modal").hasClass("hidden")) {
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

    if (!gameStarted || hasWon || mobilePaused || scrambleIntroActive || event.touches.length !== 1) {
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

    if (touchStartX === null || touchStartY === null || !gameStarted || hasWon || mobilePaused || scrambleIntroActive) {
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
    $(window).off(EVENT_NAMESPACE);
    $(document).off(EVENT_NAMESPACE);
    $("#board").off(EVENT_NAMESPACE);
    $("#win-modal-close").off(EVENT_NAMESPACE);
    $("#win-leaderboard-button").off(EVENT_NAMESPACE);
    $("#play-again-button").off(EVENT_NAMESPACE);
    $("#win-modal").off(EVENT_NAMESPACE);
    $("#submit-score-button").off(EVENT_NAMESPACE);
    $("#change-name-button").off(EVENT_NAMESPACE);
    $("#score-name").off(EVENT_NAMESPACE);
    $("#leaderboard-button").off(EVENT_NAMESPACE);
    $("#menu-leaderboard-button").off(EVENT_NAMESPACE);
    $("#leaderboard-close").off(EVENT_NAMESPACE);
    $("#leaderboard-modal").off(EVENT_NAMESPACE);
    $(".leaderboard-level-button").off(EVENT_NAMESPACE);
    $("#restart-button").off(EVENT_NAMESPACE);
    $("#main-menu-button").off(EVENT_NAMESPACE);
    $("#mobile-pause-button").off(EVENT_NAMESPACE);
    $("#mobile-exit-button").off(EVENT_NAMESPACE);
    $("#hud-toggle-button").off(EVENT_NAMESPACE);
    $("#confirm-cancel").off(EVENT_NAMESPACE);
    $("#confirm-accept").off(EVENT_NAMESPACE);
    $("#confirm-modal").off(EVENT_NAMESPACE);
    $(".level-button").off(EVENT_NAMESPACE);

    mountScramblerCharacters();
    $(window).on("resize" + EVENT_NAMESPACE, function() {
      if (gameStarted) {
        resize();
      }
      syncMobilePlayUi();
    });

    $(document).on("keydown" + EVENT_NAMESPACE, keydown);
    $("#board").on("touchstart" + EVENT_NAMESPACE, handleBoardTouchStart);
    $("#board").on("touchend" + EVENT_NAMESPACE, handleBoardTouchEnd);
    $("#win-modal-close").on("click" + EVENT_NAMESPACE, requestWinModalClose);
    $("#win-leaderboard-button").on("click" + EVENT_NAMESPACE, showLeaderboardModal);
    $("#play-again-button").on("click" + EVENT_NAMESPACE, playAgain);
    $("#win-modal").on("click" + EVENT_NAMESPACE, function(event) {
      if (event.target === this) {
        requestWinModalClose();
      }
    });
    $("#submit-score-button").on("click" + EVENT_NAMESPACE, saveArcadeNameChange);
    $("#change-name-button").on("click" + EVENT_NAMESPACE, changeArcadeName);
    $("#score-name").on("keydown" + EVENT_NAMESPACE, function(event) {
      if (event.which === 13) {
        event.preventDefault();
        saveArcadeNameChange();
      }
    });
    $("#score-name").on("change" + EVENT_NAMESPACE + " blur" + EVENT_NAMESPACE, persistScoreNameInput);
    $("#leaderboard-button").on("click" + EVENT_NAMESPACE, showLeaderboardModal);
    $("#menu-leaderboard-button").on("click" + EVENT_NAMESPACE, showLeaderboardModal);
    $("#leaderboard-close").on("click" + EVENT_NAMESPACE, hideLeaderboardModal);
    $("#leaderboard-modal").on("click" + EVENT_NAMESPACE, function(event) {
      if (event.target === this) {
        hideLeaderboardModal();
      }
    });
    $(".leaderboard-level-button").on("click" + EVENT_NAMESPACE, function() {
      showLeaderboardLevel($(this).data("level"));
    });
    $("#restart-button").on("click" + EVENT_NAMESPACE, requestRestart);
    $("#main-menu-button").on("click" + EVENT_NAMESPACE, requestMainMenu);
    $("#mobile-pause-button").on("click" + EVENT_NAMESPACE, toggleMobilePause);
    $("#mobile-exit-button").on("click" + EVENT_NAMESPACE, requestMainMenu);
    $("#hud-toggle-button").on("click" + EVENT_NAMESPACE, function() {
      setHudExpanded(!$("#hud").hasClass("hud-expanded"));
    });
    $("#confirm-cancel").on("click" + EVENT_NAMESPACE, hideConfirmModal);
    $("#confirm-accept").on("click" + EVENT_NAMESPACE, function() {
      let action = confirmAction;

      hideConfirmModal();

      if (action) {
        action();
      }
    });
    $("#confirm-modal").on("click" + EVENT_NAMESPACE, function(event) {
      if (event.target === this) {
        hideConfirmModal();
      }
    });
    $(".level-button").on("click" + EVENT_NAMESPACE, function() {
      startGame($(this).data("level"));
    });

    $("#board").addClass("hidden");
    syncMobilePlayUi();
    updateHud();
    showStartMenu();
  }

  init();

  return function cleanupBeatTheScrambler() {
    stopTimer();
    clearScrambleIntroTimer();
    $(window).off(EVENT_NAMESPACE);
    $(document).off(EVENT_NAMESPACE);
    $("#board").off(EVENT_NAMESPACE).addClass("hidden");
    $("#board .tile").remove();
    $("#win-modal-close").off(EVENT_NAMESPACE);
    $("#win-leaderboard-button").off(EVENT_NAMESPACE);
    $("#play-again-button").off(EVENT_NAMESPACE);
    $("#win-modal").off(EVENT_NAMESPACE);
    $("#submit-score-button").off(EVENT_NAMESPACE);
    $("#change-name-button").off(EVENT_NAMESPACE);
    $("#score-name").off(EVENT_NAMESPACE);
    $("#leaderboard-button").off(EVENT_NAMESPACE);
    $("#menu-leaderboard-button").off(EVENT_NAMESPACE);
    $("#leaderboard-close").off(EVENT_NAMESPACE);
    $("#leaderboard-modal").off(EVENT_NAMESPACE);
    $(".leaderboard-level-button").off(EVENT_NAMESPACE);
    $("#restart-button").off(EVENT_NAMESPACE);
    $("#main-menu-button").off(EVENT_NAMESPACE);
    $("#mobile-pause-button").off(EVENT_NAMESPACE);
    $("#mobile-exit-button").off(EVENT_NAMESPACE);
    $("#hud-toggle-button").off(EVENT_NAMESPACE);
    $("#confirm-cancel").off(EVENT_NAMESPACE);
    $("#confirm-accept").off(EVENT_NAMESPACE);
    $("#confirm-modal").off(EVENT_NAMESPACE);
    $(".level-button").off(EVENT_NAMESPACE);
    exitMobilePlayMode();
  };
}
