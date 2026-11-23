import { DiscoverView } from "@/components/discover/discover-view";
import { listHubs } from "@/server/hubs";
import { requireRole } from "@/server/session";

export const metadata = { title: "Discover SportsHubs – Sidelines" };
export const dynamic = "force-dynamic";

export default async function OrganizerDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; filter?: string }>;
}) {
  const user = await requireRole("organizer");
  const { q, view, filter } = await searchParams;
  const hubs = await listHubs(user.id);

  return (
    <DiscoverView
      hubs={hubs}
      initialQuery={q ?? ""}
      initialView={view === "map" ? "map" : "list"}
      initialFilter={filter === "followed" ? "followed" : "all"}
      basePath="/organizer/discover"
    />
  );
}
