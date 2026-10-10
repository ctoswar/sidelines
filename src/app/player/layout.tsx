import { Sidebar, type NavItem } from "@/components/dashboard/sidebar";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { MY_TEAM } from "@/lib/mock-data";

const items: NavItem[] = [
  { href: "/player", label: "Home" },
  { href: "/player/registrations", label: "My events" },
  { href: "/player/schedule", label: "My schedule" },
  { href: "/player/team", label: "My team" },
  { href: "/player/tournaments", label: "Find tournaments" },
  { href: "/player/profile", label: "Profile" },
];

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceGuard role="player">
      <div className="workspace-shell min-h-screen md:grid md:grid-cols-[248px_1fr]">
        <Sidebar items={items} roleLabel="Player" footer={MY_TEAM} />
        <main className="workspace-main mx-auto w-full max-w-5xl p-5 md:p-10">{children}</main>
      </div>
    </WorkspaceGuard>
  );
}
