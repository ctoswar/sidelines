import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EventHub } from "@/components/dashboard/event-hub";
import { loadEventDetail } from "@/server/events";

// Same DB-backed render as the public event page (Phase 6): no
// generateStaticParams, so the build stays database-free and each hub view
// loads fresh registrations and announcements. cache() shares the metadata
// and body query; notFound() in generateMetadata makes the 404 a real status.
const detailFor = cache(loadEventDetail);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = await detailFor(slug);
  if (!detail) notFound();
  return { title: `${detail.event.name} hub – Sidelines` };
}

export default async function OrganizerEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await detailFor(slug);
  if (!detail) notFound();
  return <EventHub slug={slug} detail={detail} />;
}
