export const SCORE_TUNING = {
  distanceMultiplier: 0.018,
  survivalMultiplier: 8,
  nearMissBase: 250,
  streakStep: 75,
  streakCap: 6
};

export function getDistanceScore(distance: number) {
  return Math.floor(distance * SCORE_TUNING.distanceMultiplier);
}

export function getSurvivalScore(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds * SCORE_TUNING.survivalMultiplier);
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
