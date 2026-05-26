"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { NearMissGameLoop, type NearMissSnapshot } from "./engine/gameLoop";
import { createInputController, type NearMissControl, type NearMissInputController } from "./engine/input";
import { NearMissGameOverModal } from "./ui/NearMissGameOverModal";
import { NearMissHud } from "./ui/NearMissHud";
import styles from "./styles.module.css";

const BEST_SCORE_KEY = "soft-arcade-near-miss-best-score";

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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<NearMissGameLoop | null>(null);
  const inputRef = useRef<NearMissInputController | null>(null);
  const [snapshot, setSnapshot] = useState<NearMissSnapshot>(initialSnapshot);

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
      input.cleanup();
      resizeObserver.disconnect();
      loop.destroy();
      loopRef.current = null;
      inputRef.current = null;
    };
  }, [persistBestScore]);

  const startRun = useCallback(() => {
    loopRef.current?.start();
  }, []);

  const restartRun = useCallback(() => {
    const bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    loopRef.current?.restart(bestScore);
  }, []);

  return (
    <div className={styles.gameShell} data-game-shell="near-miss" aria-label="Near Miss game">
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
      {snapshot.status === "running" ? <NearMissMobileControls inputRef={inputRef} /> : null}
    </div>
  );
}

type NearMissMobileControlsProps = {
  inputRef: RefObject<NearMissInputController | null>;
};

type NearMissControlButtonProps = {
  control: NearMissControl;
  className?: string;
  label: string;
  inputRef: RefObject<NearMissInputController | null>;
};

function NearMissMobileControls({ inputRef }: NearMissMobileControlsProps) {
  return (
    <div className={styles.mobileControls} aria-label="Near Miss mobile controls">
      <div className={styles.mobileSteeringControls}>
        <NearMissControlButton control="left" className={styles.mobileControlRound} label="←" inputRef={inputRef} />
        <NearMissControlButton control="right" className={styles.mobileControlRound} label="→" inputRef={inputRef} />
      </div>
      <div className={styles.mobilePedalControls}>
        <NearMissControlButton control="brake" className={styles.mobileControlPedal} label="BRAKE" inputRef={inputRef} />
        <NearMissControlButton control="throttle" className={styles.mobileControlPedal} label="GAS" inputRef={inputRef} />
      </div>
    </div>
  );
}

function NearMissControlButton({ control, className, label, inputRef }: NearMissControlButtonProps) {
  const setActive = useCallback(
    (active: boolean) => {
      inputRef.current?.setControl(control, active);
    },
    [control, inputRef]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setActive(true);
    },
    [setActive]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setActive(false);
    },
    [setActive]
  );

  return (
    <button
      type="button"
      className={`${styles.mobileControlButton} ${className || ""}`}
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerUp}
      onPointerUp={handlePointerUp}
    >
      {label}
    </button>
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
