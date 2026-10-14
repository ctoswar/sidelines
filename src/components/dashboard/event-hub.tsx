"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/dashboard/use-toast";
import { fetchRegistrationState, removeRegistration, type Registration } from "@/lib/registrations";
import { createAnnouncement, deleteAnnouncement, fetchAnnouncements, type Announcement } from "@/lib/announcements";
import type { EventDetail } from "@/lib/event-detail";

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="font-score text-4xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function EventHub({ slug, detail }: { slug: string; detail: EventDetail }) {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const { show, node } = useToast();

  const refresh = useCallback(() => {
    let alive = true;
    // The inbox list is organizer-only on the server; everyone else gets null.
    fetchRegistrationState(slug)
      .then((state) => { if (alive) setRegs(state.registrations ?? []); })
      .catch(() => { /* keep whatever is on screen */ });
    fetchAnnouncements({ slug })
      .then((rows) => { if (alive) setAnns(rows); })
      .catch(() => { /* keep whatever is on screen */ });
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => refresh(), [refresh]);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      // The author is the publishing session — the server decides, not the form.
      const created = await createAnnouncement({ slug, title, body });
      setAnns((current) => [created, ...current]);
      setTitle("");
      setBody("");
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not publish the announcement");
    }
  };

  const removeReg = async (id: string) => {
    try {
      await removeRegistration(slug, id);
      setRegs((current) => current.filter((r) => r.id !== id));
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not remove the registration");
    }
  };

  const removeAnn = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      setAnns((current) => current.filter((a) => a.id !== id));
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not delete the announcement");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/events/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <div className="mb-6">
        <Link href="/organizer/events" className="text-sm text-muted hover:text-fg">← All events</Link>
        <h1 className="font-score text-4xl font-bold tracking-tight">{detail.event.name}</h1>
        <p className="mt-1 text-muted">
          {detail.venue.name} · {detail.tz.label} · {detail.fields} courts
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Registered" value={regs.length} />
        <Stat label="Teams" value={detail.event.teams} />
        <Stat label="Games" value={detail.matches.length} />
        <Stat label="Days" value={detail.days} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button className="btn" onClick={copyLink}>{copied ? "Link copied ✓" : "Copy spectator link"}</button>
        <Link className="btn" href="/organizer/schedule">Schedule</Link>
        <Link className="btn" href="/organizer/score">Score a game</Link>
        <Link className="btn" href={`/events/${slug}`}>View public page</Link>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 font-bold">Registration inbox</h2>
        {regs.length === 0 ? (
          <div className="rounded-lg border border-line bg-card p-6 text-center text-muted">
            No registrations yet. Share the spectator link to open signups.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-card">
            <table className="w-full text-left">
              <thead className="text-sm text-muted">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Registered</th>
                  <th className="p-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {regs.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-bold">{r.name}</td>
                    <td className="p-3 text-muted">{r.email || "—"}</td>
                    <td className="p-3 capitalize">{r.role === "organizer" ? "Organizer" : r.role === "player" ? "Player" : "Guest"}</td>
                    <td className="p-3 text-muted">{day(r.at)}</td>
                    <td className="p-3 text-right">
                      <button
                        className="text-sm text-flag hover:underline"
                        onClick={() => removeReg(r.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold">Announcements</h2>
        <form onSubmit={publish} className="mb-4 rounded-lg border border-line bg-card p-4">
          <input
            className="inp mb-2 w-full"
          placeholder="Title — e.g. Court 2 closed until 14:00"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
          />
          <textarea
            className="inp mb-2 w-full"
            placeholder="What should players know?"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
          />
          <button className="btn btn-pri" disabled={!title.trim() || !body.trim()}>Publish to players</button>
        </form>
        {anns.length === 0 ? (
          <div className="rounded-lg border border-line bg-card p-6 text-center text-muted">
            No announcements posted yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {anns.map((a) => (
              <li key={a.id} className="rounded-lg border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{a.title}</p>
                    <p className="text-sm text-muted">{a.body}</p>
                    <p className="mt-1 text-xs text-muted">{a.author} · {day(a.at)}</p>
                  </div>
                  <button
                    className="text-sm text-flag hover:underline"
                    onClick={() => removeAnn(a.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {node}
    </>
  );
}
