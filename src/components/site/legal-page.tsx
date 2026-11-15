import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Shared chrome for the three footer pages (contact, privacy, terms).
 *
 * TODO(owner): the copy below is a working default written for the audit.
 * Have counsel review the privacy notice and terms before a public launch,
 * and replace SUPPORT_EMAIL with a monitored inbox.
 */
export const SUPPORT_EMAIL = "support@sidelines.app";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page-inner">
          <p className="legal-kicker">Sidelines</p>
          <h1>{title}</h1>
          <p className="legal-intro">{intro}</p>
          <div className="legal-body">{children}</div>
        </div>
      </main>
      <SiteFooter className="events-footer" />
    </>
  );
}
