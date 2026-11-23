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

export default async function OrganizerSportsHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireRole("organizer");
  // Load with the viewer so the organizer's own hub renders its ownership
  // state and public actions stay hidden.
  const hub = await loadHubDetail(slug, user.id);
  if (!hub) notFound();

  return <HubDetailView hub={hub} basePath="/organizer/discover" />;
}
