export const metadata = {
  title: "Terms"
};

export default function TermsPage() {
  return (
    <main className="text-page">
      <p className="eyebrow">Soft Arcade</p>
      <h1>Terms</h1>
      <p>Soft Arcade is a small collection of browser games. No account is required, and the rules are meant to stay simple.</p>

      <section>
        <h2>Arcade Names And Scores</h2>
        <p>Arcade names and leaderboard scores are user-submitted. Keep names short, readable, and appropriate for a public scoreboard.</p>
        <p>Offensive, spammy, impersonating, or otherwise disruptive arcade names may be removed. Scores that appear to come from cheating, automation, bugs, or exploits may also be removed.</p>
      </section>

      <section>
        <h2>Leaderboards</h2>
        <p>Leaderboards are part of the fun, but they are not permanent records. Scores may be reset, corrected, migrated, or removed as the arcade changes.</p>
      </section>

      <section>
        <h2>Games</h2>
        <p>Games are provided as-is. Soft Arcade aims to keep them playable and fair, but there are no guarantees that every game, score, feature, or saved local best will always be available.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms can be sent to <a href="mailto:softarcadegames@gmail.com">softarcadegames@gmail.com</a>.</p>
      </section>
    </main>
  );
}
