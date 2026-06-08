"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from "react";
import posthog from "posthog-js";
import { NearMissGameLoop, type NearMissSnapshot } from "./engine/gameLoop";
import { createInputController, type NearMissControl, type NearMissInputController } from "./engine/input";
import { NearMissGameOverModal } from "./ui/NearMissGameOverModal";
import { NearMissHud } from "./ui/NearMissHud";
import { NearMissLeaderboardScreen } from "./ui/NearMissLeaderboardScreen";
import blueSedanSprite from "./ui/blue-sedan.svg";
import redCarSprite from "./ui/redcar.svg";
import { getArcadeName, setArcadeName } from "@/lib/arcadeName";
import { notifyLeaderboardUpdated, submitLeaderboardScore } from "@/lib/leaderboards/api";
import { getLeaderboardConfig } from "@/lib/leaderboards/config";
import { sanitizePlayerName } from "@/lib/leaderboards/scoreNames";
import styles from "./styles.module.css";

const BEST_SCORE_KEY = "soft-arcade-near-miss-best-score";
const MOBILE_PLAY_BREAKPOINT = "(max-width: 720px)";
const NEAR_MISS_GAME_ID = "near-miss";
const NEAR_MISS_SCORING_VERSION = 1;

const initialSnapshot: NearMissSnapshot = {
  status: "ready",
  score: 0,
  speed: 0,
  averageSpeed: 0,
  distance: 0,
  elapsed: 0,
  nearMisses: 0,
  streak: 0,
  bestScore: 0,
  message: "THREAD THE GAP",
  debug: false
};

type ScoreSubmissionState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

const initialScoreSubmission: ScoreSubmissionState = {
  status: "idle",
  message: "Enter a name to save your first score."
};

export function NearMissGame() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<NearMissGameLoop | null>(null);
  const inputRef = useRef<NearMissInputController | null>(null);
  const visibilityPausedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<NearMissSnapshot>(initialSnapshot);
  const snapshotRef = useRef(snapshot);
  const runIdRef = useRef(0);
  const runBestAtStartRef = useRef(0);
  const submittedRunIdRef = useRef<number | null>(null);
  const [mobilePlayMode, setMobilePlayMode] = useState(false);
  const [mobilePaused, setMobilePaused] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [nameEntryOpen, setNameEntryOpen] = useState(false);
  const [scoreSubmission, setScoreSubmission] = useState<ScoreSubmissionState>(initialScoreSubmission);

  const persistBestScore = useCallback((score: number) => {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score));
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;

    if (!frame || !canvas) {
      return;
    }

    const bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    runBestAtStartRef.current = bestScore;
    const loop = new NearMissGameLoop({
      canvas,
      bestScore,
      onSnapshot: setSnapshot,
      onBestScore: persistBestScore
    });
    const resize = () => loop.resize(frame.clientWidth, frame.clientHeight);
    const resizeObserver = new ResizeObserver(resize);
    const input = createInputController((nextInput) => loop.setInput(nextInput));

    loopRef.current = loop;
    inputRef.current = input;
    resize();
    setSnapshot(loop.getSnapshot());
    resizeObserver.observe(frame);

    return () => {
      input.clearAllInputs();
      input.cleanup();
      resizeObserver.disconnect();
      loop.destroy();
      loopRef.current = null;
      inputRef.current = null;
    };
  }, [persistBestScore]);

  useEffect(() => {
    setPlayerName(getArcadeName());
  }, []);

  const clearAllInputs = useCallback(() => {
    inputRef.current?.clearAllInputs();
  }, []);

  const isMobileLayout = useCallback(() => window.matchMedia(MOBILE_PLAY_BREAKPOINT).matches, []);

  const focusMobileGame = useCallback(() => {
    if (!isMobileLayout()) {
      return Promise.resolve(false);
    }

    const shell = shellRef.current;

    if (!shell) {
      return Promise.resolve(false);
    }

    const viewportPadding = 8;
    const bottomVisibilityBias = 18;
    const shellRect = shell.getBoundingClientRect();
    const shellTop = shellRect.top + window.scrollY;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const availableHeight = viewportHeight - viewportPadding * 2;
    const centeredTop = (availableHeight - shellRect.height) / 2;
    const desiredTop =
      shellRect.height <= availableHeight
        ? Math.max(viewportPadding, centeredTop - bottomVisibilityBias)
        : viewportPadding;
    const targetTop = shellTop - desiredTop;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "auto"
    });

    return new Promise<boolean>((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => resolve(true), 60);
      });
    });
  }, [isMobileLayout]);

  const enterMobilePlayMode = useCallback(async () => {
    const didFocus = await focusMobileGame();

    if (didFocus) {
      setMobilePlayMode(true);
    }

    return didFocus;
  }, [focusMobileGame]);

  const startRun = useCallback(async () => {
    const bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);

    clearAllInputs();
    visibilityPausedRef.current = false;
    runIdRef.current += 1;
    runBestAtStartRef.current = bestScore;
    submittedRunIdRef.current = null;
    setLeaderboardOpen(false);
    setPlayerName(getArcadeName());
    setNameEntryOpen(false);
    setScoreSubmission(initialScoreSubmission);
    const didEnterMobilePlayMode = await enterMobilePlayMode();
    setMobilePaused(false);
    loopRef.current?.start();
    posthog.capture("game_started", { game: "near-miss" });

    if (!didEnterMobilePlayMode) {
      setMobilePlayMode(false);
    }
  }, [clearAllInputs, enterMobilePlayMode]);

  const restartRun = useCallback(async () => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    runIdRef.current += 1;
    submittedRunIdRef.current = null;
    setPlayerName(getArcadeName());
    setNameEntryOpen(false);
    setLeaderboardOpen(false);
    setScoreSubmission(initialScoreSubmission);
    const bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    runBestAtStartRef.current = bestScore;
    const didEnterMobilePlayMode = await enterMobilePlayMode();
    setMobilePaused(false);
    loopRef.current?.restart(bestScore);
    posthog.capture("play_again_clicked", { game: "near-miss" });
    posthog.capture("game_restarted", { game: "near-miss" });

    if (!didEnterMobilePlayMode) {
      setMobilePlayMode(false);
    }
  }, [clearAllInputs, enterMobilePlayMode]);

  const exitRun = useCallback(() => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    submittedRunIdRef.current = null;
    setNameEntryOpen(false);
    setLeaderboardOpen(false);
    setScoreSubmission(initialScoreSubmission);
    const bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    loopRef.current?.cancelRun(bestScore);
    setMobilePaused(false);
    setMobilePlayMode(false);
  }, [clearAllInputs]);

  const submitNearMissScore = useCallback(async (nameOverride?: string) => {
    const activeRunId = runIdRef.current;
    const sanitizedName = sanitizePlayerName(nameOverride ?? playerName);
    const submitEndpoint = getLeaderboardConfig(NEAR_MISS_GAME_ID).submitEndpoint;

    if (!submitEndpoint || snapshot.status !== "gameOver") {
      return;
    }

    if (submittedRunIdRef.current === activeRunId) {
      return;
    }

    if (!sanitizedName) {
      setNameEntryOpen(true);
      setScoreSubmission({
        status: "error",
        message: "Enter a name with at least 1 character."
      });
      return;
    }

    submittedRunIdRef.current = activeRunId;
    setPlayerName(sanitizedName);
    setArcadeName(sanitizedName);
    setNameEntryOpen(false);
    setScoreSubmission({
      status: "saving",
      message: "Saving score..."
    });
    posthog.capture("score_auto_save_started", { game: "near-miss" });

    try {
      await submitLeaderboardScore(submitEndpoint, {
        name: sanitizedName,
        score: Math.max(0, Math.floor(snapshot.score)),
        distance: Math.max(0, Math.floor(snapshot.distance)),
        elapsed_seconds: Math.max(0, Math.floor(snapshot.elapsed)),
        near_misses: Math.max(0, Math.floor(snapshot.nearMisses)),
        average_speed: Math.max(0, Math.round(snapshot.averageSpeed)),
        scoring_version: NEAR_MISS_SCORING_VERSION
      });
      setScoreSubmission({
        status: "saved",
        message: `Saved as ${sanitizedName}`
      });
      notifyLeaderboardUpdated(NEAR_MISS_GAME_ID);
      posthog.capture("score_auto_save_success", { game: "near-miss" });
      posthog.capture("score_submitted", {
        game: "near-miss",
        score: Math.max(0, Math.floor(snapshot.score)),
        near_misses: Math.max(0, Math.floor(snapshot.nearMisses)),
        distance: Math.max(0, Math.floor(snapshot.distance)),
        elapsed_seconds: Math.max(0, Math.floor(snapshot.elapsed)),
        average_speed: Math.max(0, Math.round(snapshot.averageSpeed))
      });
    } catch (error) {
      setScoreSubmission({
        status: "error",
        message: "Score could not be saved."
      });
      posthog.capture("score_auto_save_failed", {
        game: "near-miss",
        error: error instanceof Error ? error.message : "Score submission failed."
      });
      posthog.capture("score_submit_failed", {
        game: "near-miss",
        error: error instanceof Error ? error.message : "Score submission failed."
      });
    }
  }, [playerName, snapshot]);

  useEffect(() => {
    if (snapshot.status !== "gameOver") {
      return;
    }

    const savedName = getArcadeName();

    if (!savedName) {
      setNameEntryOpen(true);
      setScoreSubmission({
        status: "idle",
        message: "Enter a name to save your first score."
      });
      return;
    }

    setPlayerName(savedName);
    setNameEntryOpen(false);
    void submitNearMissScore(savedName);
  }, [snapshot.status, submitNearMissScore]);

  const changeArcadeName = useCallback(() => {
    setPlayerName(getArcadeName());
    setNameEntryOpen(true);
    setScoreSubmission((current) => ({
      ...current,
      message: current.status === "saved" ? current.message : "Enter a name to save your score."
    }));
  }, []);

  const saveArcadeNameChange = useCallback(() => {
    const sanitizedName = sanitizePlayerName(playerName);

    if (!sanitizedName) {
      setScoreSubmission({
        status: "error",
        message: "Enter a name with at least 1 character."
      });
      return;
    }

    setPlayerName(sanitizedName);
    setArcadeName(sanitizedName);
    posthog.capture("arcade_name_set", { game: "near-miss" });

    if (snapshot.status === "gameOver" && submittedRunIdRef.current !== runIdRef.current) {
      void submitNearMissScore(sanitizedName);
      return;
    }

    setNameEntryOpen(false);
    setScoreSubmission((current) => ({
      ...current,
      message: current.status === "saved" ? `Saved as ${sanitizedName}` : `Arcade name saved as ${sanitizedName}.`
    }));
  }, [playerName, snapshot.status, submitNearMissScore]);

  const pauseRun = useCallback(() => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    loopRef.current?.pause();
    setMobilePaused(true);
  }, [clearAllInputs]);

  const resumeRun = useCallback(async () => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    await enterMobilePlayMode();
    setMobilePaused(false);
    loopRef.current?.start();
  }, [clearAllInputs, enterMobilePlayMode]);

  const openLeaderboard = useCallback(() => {
    setLeaderboardOpen(true);
    clearAllInputs();
    posthog.capture("leaderboard_opened", { game: "near-miss" });
  }, [clearAllInputs]);

  const closeLeaderboard = useCallback(() => {
    setLeaderboardOpen(false);
  }, []);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (snapshot.status !== "running") {
      clearAllInputs();
      visibilityPausedRef.current = false;
      setMobilePaused(false);
    }
  }, [clearAllInputs, snapshot.status]);

  useEffect(() => {
    if (snapshot.status === "gameOver") {
      const s = snapshotRef.current;
      posthog.capture("game_over", {
        game: "near-miss",
        score: Math.floor(s.score),
        near_misses: Math.floor(s.nearMisses),
        distance: Math.floor(s.distance),
        elapsed_seconds: Math.floor(s.elapsed),
        average_speed: Math.round(s.averageSpeed),
        is_new_best: s.score > s.bestScore
      });
    }
  }, [snapshot.status]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearAllInputs();
        if (snapshot.status === "running") {
          visibilityPausedRef.current = true;
          loopRef.current?.pause();
          setMobilePaused(true);
        }
        return;
      }

      if (visibilityPausedRef.current && snapshot.status === "running" && !isMobileLayout()) {
        visibilityPausedRef.current = false;
        setMobilePaused(false);
        loopRef.current?.start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearAllInputs, isMobileLayout, snapshot.status]);

  useEffect(() => {
    if (!mobilePlayMode || mobilePaused || snapshot.status !== "running") {
      return;
    }

    const scrollY = window.scrollY;
    const { body } = document;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const previousOverflow = body.style.overflow;

    body.classList.add("near-miss-mobile-play-mode");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.classList.remove("near-miss-mobile-play-mode");
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [mobilePaused, mobilePlayMode, snapshot.status]);

  const reserveMobileControls = mobilePlayMode && snapshot.status !== "ready" && !leaderboardOpen;
  const mobileControlsDisabled = mobilePaused || snapshot.status !== "running";
  const mobileScrollLocked = mobilePlayMode && !mobilePaused && snapshot.status === "running";

  return (
    <div
      className={styles.gameShell}
      data-game-shell="near-miss"
      data-mobile-play-mode={mobileScrollLocked ? "true" : undefined}
      ref={shellRef}
      aria-label="Near Miss game"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {mobilePlayMode && !leaderboardOpen ? (
        <div className={styles.mobilePlayActions} aria-label="Near Miss mobile play mode controls">
          {snapshot.status === "running" ? (
            <button type="button" onClick={mobilePaused ? resumeRun : pauseRun}>
              {mobilePaused ? "Resume" : "Pause"}
            </button>
          ) : null}
          <button type="button" onClick={exitRun}>
            Exit
          </button>
        </div>
      ) : null}
      <div className={styles.gameFrame} ref={frameRef}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label="Near Miss traffic lanes" />
        <NearMissHud snapshot={snapshot} />
        {snapshot.status === "ready" ? <div className={styles.feedbackLine}>THREAD THE GAP</div> : null}

        {snapshot.status === "ready" ? (
          <div className={styles.startOverlay}>
            <div className={styles.startPanel}>
              <p className={styles.startKicker}>Soft Arcade</p>
              <h2 className={styles.startTitle}>Near Miss</h2>
              <span className={styles.startTagline}>Steer through traffic. Brake late. Chase clean close calls.</span>
              <div className={styles.scgMascot} aria-hidden="true">
                <div className={styles.scgRoad}>
                  <div className={styles.scgLaneTrack}></div>
                </div>
                <img src={blueSedanSprite.src} alt="" className={styles.scgTrafficCar} />
                <img src={redCarSprite.src} alt="" className={styles.scgCar} />
                <div className={styles.scgShadow}></div>
              </div>
              <button type="button" className={styles.startRunButton} onClick={startRun}>
                Start Run
              </button>
              <button type="button" className={styles.startLeaderboardButton} onClick={openLeaderboard}>
                Leaderboard
              </button>
            </div>
          </div>
        ) : null}

        {leaderboardOpen ? <NearMissLeaderboardScreen onBack={closeLeaderboard} /> : null}

        {snapshot.status === "gameOver" && snapshot.debug ? <NearMissDebugToolbar snapshot={snapshot} onRestart={restartRun} /> : null}
        {snapshot.status === "gameOver" && !snapshot.debug && !leaderboardOpen ? (
          <NearMissGameOverModal
            playerName={playerName}
            scoreSubmission={scoreSubmission}
            snapshot={snapshot}
            bestScore={Math.max(snapshot.bestScore, runBestAtStartRef.current)}
            isNewBest={snapshot.score > runBestAtStartRef.current}
            onPlayerNameChange={setPlayerName}
            onRestart={restartRun}
            onBackToMenu={exitRun}
            onChangeName={changeArcadeName}
            onLeaderboard={openLeaderboard}
            onSubmitScore={saveArcadeNameChange}
            showNameEntry={nameEntryOpen}
          />
        ) : null}
      </div>
      {reserveMobileControls ? <NearMissMobileControls inputRef={inputRef} disabled={mobileControlsDisabled} /> : null}
    </div>
  );
}

type NearMissMobileControlsProps = {
  inputRef: RefObject<NearMissInputController | null>;
  disabled: boolean;
};

type NearMissControlButtonProps = {
  control: NearMissControl;
  className?: string;
  disabled: boolean;
  label: string;
  children?: ReactNode;
  inputRef: RefObject<NearMissInputController | null>;
};

function NearMissMobileControls({ inputRef, disabled }: NearMissMobileControlsProps) {
  return (
    <div className={styles.mobileControls} data-controls-disabled={disabled ? "true" : undefined} aria-label="Near Miss mobile controls" aria-disabled={disabled}>
      <div className={styles.mobileSteeringControls}>
        <NearMissControlButton control="left" className={styles.mobileControlSteering} disabled={disabled} label="Steer left" inputRef={inputRef}>
          <SteeringIcon direction="left" />
        </NearMissControlButton>
        <NearMissControlButton control="right" className={styles.mobileControlSteering} disabled={disabled} label="Steer right" inputRef={inputRef}>
          <SteeringIcon direction="right" />
        </NearMissControlButton>
      </div>
      <div className={styles.mobilePedalControls}>
        <NearMissControlButton control="brake" className={styles.mobileControlPedal} disabled={disabled} label="BRAKE" inputRef={inputRef} />
        <NearMissControlButton control="throttle" className={styles.mobileControlPedal} disabled={disabled} label="GAS" inputRef={inputRef} />
      </div>
    </div>
  );
}

function NearMissControlButton({ control, className, disabled, label, children, inputRef }: NearMissControlButtonProps) {
  const activePointerIdRef = useRef<number | null>(null);

  const pressControl = useCallback(
    (pointerId: number) => {
      inputRef.current?.pressControl(control, pointerId);
    },
    [control, inputRef]
  );

  const releaseControl = useCallback(
    (pointerId: number) => {
      inputRef.current?.releaseControl(control, pointerId);
    },
    [control, inputRef]
  );

  useEffect(() => {
    return () => {
      const activePointerId = activePointerIdRef.current;

      if (activePointerId !== null) {
        releaseControl(activePointerId);
        activePointerIdRef.current = null;
      }
    };
  }, [releaseControl]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (disabled) {
        return;
      }
      const activePointerId = activePointerIdRef.current;

      if (activePointerId !== null && activePointerId !== event.pointerId) {
        releaseControl(activePointerId);
      }

      activePointerIdRef.current = event.pointerId;

      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      pressControl(event.pointerId);
    },
    [disabled, pressControl, releaseControl]
  );

  const handlePointerEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      activePointerIdRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      releaseControl(event.pointerId);
    },
    [releaseControl]
  );

  return (
    <button
      type="button"
      className={`${styles.mobileControlButton} ${className || ""}`}
      disabled={disabled}
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onLostPointerCapture={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
    >
      {children || label}
    </button>
  );
}

function SteeringIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className={styles.mobileSteeringIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {direction === "left" ? (
        <path d="M15.5 5.5 9 12l6.5 6.5" />
      ) : (
        <path d="m8.5 5.5 6.5 6.5-6.5 6.5" />
      )}
    </svg>
  );
}

type NearMissDebugToolbarProps = {
  snapshot: NearMissSnapshot;
  onRestart: () => void;
};

function NearMissDebugToolbar({ snapshot, onRestart }: NearMissDebugToolbarProps) {
  return (
    <div className={styles.debugToolbar} role="toolbar" aria-label="Near Miss debug crash controls">
      <div className={styles.debugToolbarStatus}>
        <span>Debug Crash</span>
        <strong>{snapshot.message}</strong>
      </div>
      <div className={styles.debugToolbarStats} aria-label="Crash stats">
        <span>Score {snapshot.score.toLocaleString()}</span>
        <span>Near Misses {snapshot.nearMisses}</span>
        <span>Time {snapshot.elapsed.toFixed(1)}s</span>
      </div>
      <button type="button" onClick={onRestart}>
        Restart
      </button>
    </div>
  );
}
