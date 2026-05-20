export const metadata = {
  title: "Privacy"
};

export default function PrivacyPage() {
  return (
    <main className="text-page">
      <p className="eyebrow">Soft Arcade</p>
      <h1>Privacy Policy</h1>
      <p>Soft Arcade is built for quick browser games without accounts. This policy explains what the site stores now and what may be used later if advertising is added.</p>

      <section>
        <h2>Information You Provide</h2>
        <p>Beat the Scrambler lets you enter an arcade name when you save a score. That arcade name, your completion time, move count, difficulty, and completion timestamp may be sent to the leaderboard service so scores can be displayed.</p>
        <p>Please do not use your full real name, email address, phone number, or other personal details as an arcade name.</p>
      </section>

      <section>
        <h2>Browser Storage</h2>
        <p>Soft Arcade uses localStorage in your browser to keep the experience fast and account-free. This may include your last entered arcade name, personal best scores, and lightweight gameplay state or preferences if added later.</p>
        <p>localStorage stays on your device unless you clear it in your browser settings. It is used so future runs can autofill your arcade name and show your local bests.</p>
      </section>

      <section>
        <h2>Analytics</h2>
        <p>Soft Arcade does not currently include a third-party analytics package. If analytics are added later, this page will be updated to explain what is collected and why.</p>
      </section>

      <section>
        <h2>Advertising And Cookies</h2>
        <p>Soft Arcade has reserved ad space, but real ads are not active yet. If Google AdSense or another ad provider is added, third-party vendors, including Google, may use cookies, web beacons, IP addresses, or similar technologies to serve ads and measure ad performance.</p>
        <p>Google&apos;s use of advertising cookies enables Google and its partners to serve ads based on visits to Soft Arcade and/or other sites on the internet. These ads may be personalized unless you opt out or your region/settings require a different mode.</p>
        <p>Third-party vendors and ad networks may also use cookies to serve ads based on prior visits to this and other websites. You can opt out of personalized advertising through <a href="https://www.google.com/settings/ads">Google Ads Settings</a> and learn more about other opt-out choices at <a href="https://www.aboutads.info">aboutads.info</a>.</p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Soft Arcade is not intended to collect personal information from children. The site does not require accounts and asks players to use short arcade names rather than real personal information.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions, privacy requests, or leaderboard concerns can be sent to <a href="mailto:softarcadegames@gmail.com">softarcadegames@gmail.com</a>.</p>
      </section>
    </main>
  );
}
