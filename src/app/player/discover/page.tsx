import { listHubs } from "@/server/hubs";
import { requireRole } from "@/server/session";
import { DiscoverView } from "./discover-view";

export const metadata = { title: "Discover SportsHubs – Sidelines" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; filter?: string }>;
}) {
  const user = await requireRole("player");
  const { q, view, filter } = await searchParams;
  const hubs = await listHubs(user.id);

  return (
    <DiscoverView
      hubs={hubs}
      initialQuery={q ?? ""}
      initialView={view === "map" ? "map" : "list"}
      initialFilter={filter === "followed" ? "followed" : "all"}
    />
  );
}
