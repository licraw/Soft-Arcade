export const SCORE_TUNING = {
  // Core scoring weights live here. Gameplay-pressure modifiers that depend on
  // player state, such as safe-channel behavior, live in tuning.ts.
  distanceMultiplier: 0.018,
  survivalMultiplier: 8,
  speedMultiplier: 0.24,
  nearMissBase: 250,
  streakStep: 75,
  streakCap: 6,
  comboWindow: 2.35,
  brakingScorePenalty: 0.9,
  brakingNearMissPenalty: 0.82
};

export function getDistanceScore(distance: number) {
  return Math.floor(distance * SCORE_TUNING.distanceMultiplier);
}

export function getSurvivalScore(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds * SCORE_TUNING.survivalMultiplier);
}

export function getSpeedScore(speed: number, baselineSpeed: number, elapsedSeconds: number) {
  const speedRatio = Math.max(0, speed / baselineSpeed - 0.75);

  return Math.floor(speedRatio * elapsedSeconds * SCORE_TUNING.speedMultiplier * 100);
}

export function getNearMissBonus(streak: number) {
  const streakBoost = Math.min(streak, SCORE_TUNING.streakCap) * SCORE_TUNING.streakStep;

  return SCORE_TUNING.nearMissBase + streakBoost;
}

export function getFeedbackForStreak(streak: number) {
  if (streak >= 5) {
    return "LANE STREAK";
  }

  if (streak >= 3) {
    return "THREAD THE GAP";
  }

  return "NEAR MISS";
}
