import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Terms of service – Sidelines",
  description: "The rules for using Sidelines: accounts, events, scoring and conduct.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="Sidelines is a tool for running and following pickleball events. These terms cover the platform; each event's own rules cover play on the court."
    >
      {/* TODO(owner): working default for the audit — have counsel review
          before launch, and add the entity, governing law and venue. */}
      <section>
        <h2>Accounts</h2>
        <p>
          You are responsible for your account and the content you publish. One person, one
          account; keep your password safe. Player accounts register and follow events, organizer
          accounts run them, and admin accounts curate the site.
        </p>
      </section>
      <section>
        <h2>Events and play</h2>
        <ul>
          <li>
            Registration places you (or your entrant) in the division you picked. Eligibility —
            gender, age bracket, skill level and partner rules — is set by the event organizer and
            may be checked at check-in.
          </li>
          <li>
            Matches are played under the rules the organizer publishes for that event. Sidelines
            records what scorekeepers and umpires submit.
          </li>
          <li>
            Entry fees, refunds and cancellations are between you and the organizer. Sidelines does
            not process payments.
          </li>
        </ul>
      </section>
      <section>
        <h2>Scoring and results</h2>
        <p>
          Scores submitted by a game scorekeeper, umpire or organizer are final for that event.
          If a recorded result is wrong, ask the organizer to correct it — standings, pools and
          brackets update when they do.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not misuse the service: no scraping other players&apos; data, no interfering with live
          scoring, no impersonating anyone, no content that is abusive or unlawful. Organizers are
          responsible for the events they publish and the crew they invite.
        </p>
      </section>
      <section>
        <h2>Health and safety</h2>
        <p>
          Pickleball is a physical sport. Playing is at your own risk; make sure you are fit to
          play and follow the venue and event safety rules.
        </p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          We work to keep live scoring and schedules accurate, but the service is provided as-is and
          we can change or discontinue features. Last updated November 2026.
        </p>
      </section>
    </LegalPage>
  );
}
