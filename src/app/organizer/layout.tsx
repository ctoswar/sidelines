import { Sidebar, type NavItem } from "@/components/dashboard/sidebar";
import { requireRole } from "@/server/session";
import { loadOrganizationName } from "@/server/organizations";

const items: NavItem[] = [
  { href: "/organizer", label: "Tournaments", also: ["/organizer/tournaments"] },
  { href: "/organizer/events", label: "Event hub" },
  { href: "/organizer/teams", label: "Teams" },
  { href: "/organizer/schedule", label: "Schedule" },
  { href: "/organizer/scorekeepers", label: "Scorekeepers" },
  { href: "/organizer/score", label: "Score a game" },
];

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: verifies the session and role before the workspace
  // renders. The client WorkspaceGuard is gone — it ran after paint.
  const user = await requireRole("organizer");
  // Sidebar footer: the organizer's own organization, not a hardcoded brand.
  const organization = (await loadOrganizationName(user.id)) ?? "Sidelines";

  return (
    <div className="workspace-shell min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <Sidebar items={items} roleLabel="Organizer" footer={organization} />
      <main className="workspace-main mx-auto w-full max-w-6xl p-5 md:p-10">{children}</main>
    </div>
  );
}
