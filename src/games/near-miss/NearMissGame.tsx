"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from "react";
import { NearMissGameLoop, type NearMissSnapshot } from "./engine/gameLoop";
import { createInputController, type NearMissControl, type NearMissInputController } from "./engine/input";
import { NearMissGameOverModal } from "./ui/NearMissGameOverModal";
import { NearMissHud } from "./ui/NearMissHud";
import styles from "./styles.module.css";

const BEST_SCORE_KEY = "soft-arcade-near-miss-best-score";
const MOBILE_PLAY_BREAKPOINT = "(max-width: 720px)";

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

export function NearMissGame() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<NearMissGameLoop | null>(null);
  const inputRef = useRef<NearMissInputController | null>(null);
  const visibilityPausedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<NearMissSnapshot>(initialSnapshot);
  const [mobilePlayMode, setMobilePlayMode] = useState(false);
  const [mobilePaused, setMobilePaused] = useState(false);

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
    clearAllInputs();
    visibilityPausedRef.current = false;
    const didEnterMobilePlayMode = await enterMobilePlayMode();
    setMobilePaused(false);
    loopRef.current?.start();

    if (!didEnterMobilePlayMode) {
      setMobilePlayMode(false);
    }
  }, [clearAllInputs, enterMobilePlayMode]);

  const restartRun = useCallback(async () => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    const bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    const didEnterMobilePlayMode = await enterMobilePlayMode();
    setMobilePaused(false);
    loopRef.current?.restart(bestScore);

    if (!didEnterMobilePlayMode) {
      setMobilePlayMode(false);
    }
  }, [clearAllInputs, enterMobilePlayMode]);

  const exitRun = useCallback(() => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    const bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    loopRef.current?.cancelRun(bestScore);
    setMobilePaused(false);
    setMobilePlayMode(false);
  }, [clearAllInputs]);

  const pauseRun = useCallback(() => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    loopRef.current?.pause();
    setMobilePaused(true);
  }, [clearAllInputs]);

  const resumeRun = useCallback(() => {
    clearAllInputs();
    visibilityPausedRef.current = false;
    setMobilePaused(false);
    loopRef.current?.start();
  }, [clearAllInputs]);

  useEffect(() => {
    if (snapshot.status !== "running") {
      clearAllInputs();
      visibilityPausedRef.current = false;
      setMobilePaused(false);
    }
  }, [clearAllInputs, snapshot.status]);

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
    if (!mobilePlayMode) {
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
  }, [mobilePlayMode]);

  const reserveMobileControls = mobilePlayMode && snapshot.status !== "ready";
  const mobileControlsDisabled = mobilePaused || snapshot.status !== "running";

  return (
    <div
      className={styles.gameShell}
      data-game-shell="near-miss"
      data-mobile-play-mode={mobilePlayMode ? "true" : undefined}
      ref={shellRef}
      aria-label="Near Miss game"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {mobilePlayMode ? (
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
              <p>Soft Arcade</p>
              <h2>Near Miss</h2>
              <span>Steer through traffic. Brake late. Chase clean close calls.</span>
              <button type="button" onClick={startRun}>
                Start Run
              </button>
            </div>
          </div>
        ) : null}

        {snapshot.status === "gameOver" && snapshot.debug ? <NearMissDebugToolbar snapshot={snapshot} onRestart={restartRun} /> : null}
        {snapshot.status === "gameOver" && !snapshot.debug ? <NearMissGameOverModal snapshot={snapshot} onRestart={restartRun} /> : null}
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
