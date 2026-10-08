import { Sidebar, type NavItem } from "@/components/dashboard/sidebar";

const items: NavItem[] = [
  { href: "/player", label: "Home" },
  { href: "/player/schedule", label: "My schedule" },
  { href: "/player/team", label: "My team" },
  { href: "/player/tournaments", label: "Find tournaments" },
  { href: "/player/profile", label: "Profile" },
];

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace-shell min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <Sidebar items={items} roleLabel="Player" footer="Alex Rivera · Ironwood" />
      <main className="workspace-main mx-auto w-full max-w-5xl p-5 md:p-10">{children}</main>
    </div>
  );
}
