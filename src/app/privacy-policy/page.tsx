import type { Metadata } from "next";
import { LegalPage, SUPPORT_EMAIL } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy – Sidelines",
  description: "What Sidelines collects, why, how long it is kept, and how to have it removed.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="Sidelines stores the minimum needed to run pickleball events: who you are, how you play, and what you registered for."
    >
      {/* TODO(owner): this is a working default for the audit — have counsel
          review against the jurisdictions you launch in before going public. */}
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <b>Account:</b> name, email, password (hashed — we never see it), username, and the
            role you signed up as.
          </li>
          <li>
            <b>Player profile (optional):</b> nickname, date of birth, gender, nationality, city,
            preferred format, experience level, dominant hand, a short bio, an accent colour, and a
            profile photo if you upload one.
          </li>
          <li>
            <b>Organizations:</b> organization name, type, your role in it, city, and website.
          </li>
          <li>
            <b>Event activity:</b> the events you register for (with your name, email and chosen
            division), announcements you publish, and match results you keep score for.
          </li>
          <li>
            <b>Technical:</b> session records (sign-in time, IP address, browser) used to keep your
            account secure.
          </li>
        </ul>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To create your account and keep you signed in.</li>
          <li>To place you in a division, build pools and schedules, and publish results.</li>
          <li>To let organizers contact registered players about schedule and court changes.</li>
        </ul>
      </section>
      <section>
        <h2>Who can see it</h2>
        <p>
          Your name, chosen division and registration date are visible to the organizers of the
          event you enter. Spectators see scores, standings and public event details — not your
          email address. Profile details you fill in are shown on your player profile.
        </p>
      </section>
      <section>
        <h2>Children</h2>
        {/* TODO(owner): decide the minimum age and the guardian-consent flow
            for junior divisions before launch; the signup form currently
            collects a date of birth for everyone. */}
        <p>
          Junior divisions are common in pickleball. If a player is under the age of consent in
          their country, a parent or guardian must approve the account before it is used — contact
          us and we will set that up. We do not knowingly collect data from children without it.
        </p>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p>
          Your account and profile stay until you ask us to remove them. Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will delete your account,
          profile and registrations. Results already published to a completed event may be kept for
          the historical record.
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          We set one session cookie when you sign in, so the site knows who you are. There are no
          advertising or tracking cookies.
        </p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>
          Last updated November 2026. If this policy changes in a way that affects what we do with
          your data, we will say so here.
        </p>
      </section>
    </LegalPage>
  );
}
