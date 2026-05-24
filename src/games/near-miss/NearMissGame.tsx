"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NearMissGameLoop, type NearMissSnapshot } from "./engine/gameLoop";
import { createInputController } from "./engine/input";
import { NearMissGameOverModal } from "./ui/NearMissGameOverModal";
import { NearMissHud } from "./ui/NearMissHud";
import styles from "./styles.module.css";

const BEST_SCORE_KEY = "soft-arcade-near-miss-best-score";

const initialSnapshot: NearMissSnapshot = {
  status: "ready",
  score: 0,
  speed: 0,
  distance: 0,
  elapsed: 0,
  nearMisses: 0,
  streak: 0,
  bestScore: 0,
  message: "THREAD THE GAP"
};

export function NearMissGame() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<NearMissGameLoop | null>(null);
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
    const cleanupInput = createInputController(frame, (input) => loop.setInput(input));

    loopRef.current = loop;
    resize();
    setSnapshot(loop.getSnapshot());
    resizeObserver.observe(frame);

    return () => {
      cleanupInput();
      resizeObserver.disconnect();
      loop.destroy();
      loopRef.current = null;
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
    <div className={styles.gameFrame} ref={frameRef} aria-label="Near Miss game">
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

      {snapshot.status === "gameOver" ? <NearMissGameOverModal snapshot={snapshot} onRestart={restartRun} /> : null}
    </div>
  );
}
