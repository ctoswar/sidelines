import Link from "next/link";
import type { CSSProperties } from "react";
import type { EventItem } from "@/types";
import { dayOf, formatRange, monthShort } from "@/lib/events-data";
import { AvatarStack } from "./avatar-stack";
import { CalendarIcon } from "./icons";

export function EventLogo({ e }: { e: EventItem }) {
  if (e.hasLogo)
    return (
      <div className="grid h-[90px] w-[90px] shrink-0 place-items-center rounded-lg font-score text-2xl font-bold text-white" style={{ background: e.color }} aria-hidden="true">
        {e.monogram}
      </div>
    );
  return (
    <div className="grid h-[90px] w-[90px] shrink-0 place-content-center rounded-lg bg-[#dbe7ff] text-center text-[#2f56a8]" aria-hidden="true">
      <p className="font-score text-4xl font-bold leading-none">{dayOf(e.start)}</p>
      <p className="font-score text-xl font-bold leading-none">{monthShort(e.start)}</p>
    </div>
  );
}

type EventCardProps = {
  event: EventItem;
  showFeatured?: boolean;
  variant?: "row" | "spotlight" | "compact";
  index?: number;
};

export function EventCard({ event: e, showFeatured = false, variant = "row", index = 1 }: EventCardProps) {
  const style = { "--event-color": e.color } as CSSProperties;

  if (variant === "spotlight") {
    return (
      <Link href={`/events/${e.slug}`} className="event-spotlight event-spotlight-main" style={style}>
        <div className="event-spotlight-orbit" aria-hidden="true" />
        <div className="event-spotlight-topline"><span>{e.live ? "Live from the field" : "Featured event"}</span><span>0{index}</span></div>
        <div className="event-spotlight-mark" aria-hidden="true">{e.monogram}</div>
        <div className="event-spotlight-copy">
          <p className="event-kicker">{e.tags[0]} / {e.tags[1]}</p>
          <h3>{e.name}</h3>
          <p className="event-spotlight-location">{e.city}, {e.country}</p>
          <div className="event-spotlight-bottom">
            <span>{formatRange(e.start, e.end)}</span>
            <span className="event-arrow">↗</span>
          </div>
        </div>
        {e.live && <span className="event-live-pill"><span className="pulse" />Live now</span>}
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={`/events/${e.slug}`} className="event-spotlight event-spotlight-compact" style={style}>
        <div className="event-spotlight-topline"><span>{e.live ? "On now" : "Coming up"}</span><span>0{index}</span></div>
        <div className="event-compact-body">
          <div className="event-compact-mark" aria-hidden="true">{e.monogram}</div>
          <div className="min-w-0">
            <p className="event-kicker">{e.tags[0]} / {e.tags[1]}</p>
            <h3>{e.name}</h3>
            <p className="event-spotlight-location">{e.city}, {e.country}</p>
          </div>
        </div>
        <div className="event-spotlight-bottom"><span>{formatRange(e.start, e.end)}</span><span className="event-arrow">↗</span></div>
      </Link>
    );
  }

  return (
    <Link href={`/events/${e.slug}`} className="event-row" style={style}>
      <span className="event-row-number">{String(index).padStart(2, "0")}</span>
      <div className="event-row-date"><strong>{dayOf(e.start)}</strong><span>{monthShort(e.start)}</span></div>
      <div className="event-row-mark" aria-hidden="true">{e.hasLogo ? e.monogram : <><strong>{dayOf(e.start)}</strong><span>{monthShort(e.start)}</span></>}</div>
      <div className="event-row-content">
        <div className="event-row-title"><h3>{e.name}</h3>{e.live && <span className="event-row-live"><span className="pulse" />Live</span>}</div>
        <p className="event-row-meta"><CalendarIcon />{formatRange(e.start, e.end)} <span className="event-meta-separator">/</span> {e.city}, {e.country}</p>
        <div className="event-row-tags">{e.tags.map((t) => <span key={t}>{t}</span>)}</div>
        {!showFeatured && <AvatarStack count={e.teams} />}
      </div>
      <span className="event-row-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
