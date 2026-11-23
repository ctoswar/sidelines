import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { HubDetailView } from "@/components/discover/hub-detail-view";
import { loadHubDetail } from "@/server/hubs";
import { requireRole } from "@/server/session";

export const dynamic = "force-dynamic";

const detailFor = cache((slug: string) => loadHubDetail(slug, null));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hub = await detailFor(slug);
  if (!hub) notFound();
  return { title: `${hub.name} – SportsHub – Sidelines` };
}

export default async function SportsHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireRole("player");
  // Load with the viewer so the follow button and "my booking" slots start in
  // the right state; metadata above only needs the public copy.
  const hub = await loadHubDetail(slug, user.id);
  if (!hub) notFound();

  return <HubDetailView hub={hub} basePath="/player/discover" />;
}
