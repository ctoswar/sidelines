import { Sidebar, type NavItem } from "@/components/dashboard/sidebar";
import { requireRole } from "@/server/session";

// One screen for now, and deliberately so: the admin role exists to curate
// the homepage Spotlight. Every other surface is somebody's workspace, and an
// admin has no business in it.
const items: NavItem[] = [{ href: "/admin", label: "Spotlight" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate, same as the player/organizer layouts: the real session
  // is loaded and the role verified before any admin page byte ships.
  await requireRole("admin");

  return (
    <div className="workspace-shell min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <Sidebar items={items} roleLabel="Admin" footer="Homepage curation" />
      <main className="workspace-main mx-auto w-full max-w-6xl p-5 md:p-10">{children}</main>
    </div>
  );
}
