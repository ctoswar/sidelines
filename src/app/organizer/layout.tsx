import { Sidebar, type NavItem } from "@/components/dashboard/sidebar";

const items: NavItem[] = [
  { href: "/organizer", label: "Tournaments", also: ["/organizer/tournaments"] },
  { href: "/organizer/teams", label: "Teams" },
  { href: "/organizer/schedule", label: "Schedule" },
  { href: "/organizer/scorekeepers", label: "Scorekeepers" },
  { href: "/organizer/score", label: "Score a game" },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace-shell min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <Sidebar items={items} roleLabel="Organizer" footer="Harbor Ultimate" />
      <main className="workspace-main mx-auto w-full max-w-6xl p-5 md:p-10">{children}</main>
    </div>
  );
}
