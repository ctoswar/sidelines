import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventHub } from "@/components/dashboard/event-hub";
import { events } from "@/lib/events-data";
import { getEventDetail } from "@/lib/event-detail";

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = getEventDetail(slug);
  return { title: detail ? `${detail.event.name} hub – Sidelines` : "Event hub – Sidelines" };
}

export default async function OrganizerEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = getEventDetail(slug);
  if (!detail) notFound();
  return <EventHub slug={slug} detail={detail} />;
}
