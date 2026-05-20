type DailyScrambleProps = {
  compact?: boolean;
};

export function DailyScramble({ compact = false }: DailyScrambleProps) {
  return (
    <section className={compact ? "daily-scramble daily-scramble-compact" : "daily-scramble"} aria-labelledby={compact ? "daily-scramble-rail-title" : "daily-scramble-title"}>
      {/* TODO: Add date-based puzzle seeds so every player sees the same daily board. */}
      {/* TODO: Add a daily leaderboard API once the scoring model is ready. */}
      {/* TODO: Define daily constraints for level, scramble count, and reset timing. */}
      <p className="eyebrow">Daily Scramble</p>
      <h2 id={compact ? "daily-scramble-rail-title" : "daily-scramble-title"}>One shared puzzle each day.</h2>
      <p>Best times reset tomorrow.</p>
    </section>
  );
}
