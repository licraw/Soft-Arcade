export const metadata = {
  title: "Contact"
};

export default function ContactPage() {
  return (
    <main className="text-page">
      <h1>Contact</h1>
      <p>Soft Arcade is small, so email is the best way to reach the arcade desk.</p>
      <p><a href="mailto:softarcadegames@gmail.com">softarcadegames@gmail.com</a></p>
      <p>Send bug reports, leaderboard issues, gameplay feedback, visual polish notes, or suggestions for future tiny web games.</p>
      <p>If you are reporting a leaderboard issue, include the game, difficulty, arcade name, and roughly when the score was submitted.</p>
    </main>
  );
}
