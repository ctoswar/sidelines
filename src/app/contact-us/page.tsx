import type { Metadata } from "next";
import { LegalPage, SUPPORT_EMAIL } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Contact us – Sidelines",
  description: "Reach the Sidelines team about events, accounts, scoring or your data.",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      intro="Questions about an event, your account, live scoring, or your data — start here."
    >
      <section>
        <h2>Support</h2>
        <p>
          Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and include the event name
          and, if it is about a match, the court and approximate time. We answer event-days first.
        </p>
        {/* TODO(owner): confirm this inbox is monitored before launch, or point
            at the organizer's own contact instead. */}
      </section>
      <section>
        <h2>Playing in an event</h2>
        <p>
          Registration questions (divisions, withdrawals, refunds) go to the event organizer —
          every event page lists who runs it, and announcements on the event page carry schedule
          and court changes.
        </p>
      </section>
      <section>
        <h2>Running an event</h2>
        <p>
          Create an organizer account to publish a tournament. If you already run one and need a
          hand with brackets, scorekeeping links or exports, email us with the event link.
        </p>
      </section>
      <section>
        <h2>Data requests</h2>
        <p>
          To see, correct or delete the data tied to your account, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See the{" "}
          <a href="/privacy-policy">privacy policy</a> for what we store.
        </p>
      </section>
    </LegalPage>
  );
}
