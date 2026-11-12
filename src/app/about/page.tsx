import { AboutCta } from "@/components/about/about-cta";
import { AboutFeatures } from "@/components/about/about-features";
import { AboutHero } from "@/components/about/about-hero";
import { AboutSteps } from "@/components/about/about-steps";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const features = [
  { title: "Score from the sideline", body: "Large tap targets, one-tap undo, timeouts and win-by-two scoring. Works offline and syncs when you get signal back.", bar: "bg-brand" },
  { title: "Spectators need no account", body: "Share one link or QR code. Anyone can follow live matches, schedules and court changes from their phone.", bar: "bg-flag" },
  { title: "Standings that fix themselves", body: "Edit a score and pool tables, tie-breakers and bracket seeding recalculate instantly.", bar: "bg-brand" },
];

const steps = [
  { title: "Create the tournament", body: "Name it, pick divisions and game rules." },
  { title: "Add teams", body: "Type them in or import a CSV roster." },
  { title: "Invite scorekeepers", body: "Assign each one to a court by email." },
  { title: "Share the live link", body: "Post it once. Everyone follows every rally." },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="about-page">
        <AboutHero />
        <AboutFeatures features={features} />
        <AboutSteps steps={steps} />
        <AboutCta />
      </main>
      <SiteFooter className="about-footer" />
    </>
  );
}
