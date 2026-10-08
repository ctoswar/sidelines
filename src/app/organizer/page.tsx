import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { tournaments } from "@/lib/mock-data";

export const metadata = { title: "Tournaments – Sidelines" };

export default function TournamentsPage() {
  return (
    <>
      <PageHeader title="Tournaments" subtitle={`${tournaments.length} tournaments`}>
        <Link href="/organizer/tournaments/new" className="btn btn-pri">New tournament</Link>
      </PageHeader>
      <div className="divide-y divide-line rounded-lg border border-line bg-card">
        {tournaments.map((t) => (
          <div key={t.name} className="flex flex-wrap justify-between gap-2 p-4">
            <div>
              <p className="font-bold">{t.name}</p>
              <p className="text-sm text-muted">{t.meta}</p>
            </div>
            <span className={`font-bold ${t.status === "Live" ? "text-flag" : "text-muted"}`}>{t.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}
