"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useToast } from "@/components/dashboard/use-toast";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CourtIcon,
  HeartIcon,
  ListIcon,
  MapIcon,
  PinIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/discover/icons";
import { setHubFollow } from "@/lib/hubs-client";
import type { DiscoverBasePath, HubCard } from "@/lib/hubs";

type View = "list" | "map";
type Filter = "all" | "followed";

export function DiscoverView({
  hubs,
  initialQuery,
  initialView,
  initialFilter,
  basePath,
}: {
  hubs: HubCard[];
  initialQuery: string;
  initialView: View;
  initialFilter: Filter;
  /** The workspace this directory is rendered in; links stay role-scoped. */
  basePath: DiscoverBasePath;
}) {
  const [items, setItems] = useState(hubs);
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState<View>(initialView);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [busy, setBusy] = useState("");
  const { show, node } = useToast();

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((hub) => {
      if (filter === "followed" && !hub.following) return false;
      if (!term) return true;
      return [hub.name, hub.address, hub.city, hub.country]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, query, filter]);

  const cities = useMemo(() => new Set(items.map((hub) => hub.city).filter(Boolean)), [items]);
  const followedCount = items.filter((hub) => hub.following).length;
  const ownedCount = items.filter((hub) => hub.ownedByViewer).length;

  const syncUrl = (next: { q?: string; view?: View; filter?: Filter }) => {
    const params = new URLSearchParams();
    const q = next.q ?? query;
    const v = next.view ?? view;
    const f = next.filter ?? filter;
    if (q.trim()) params.set("q", q.trim());
    if (v === "map") params.set("view", "map");
    if (f === "followed") params.set("filter", "followed");
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  };

  const toggleFollow = async (hub: HubCard) => {
    if (busy || hub.ownedByViewer) return;
    setBusy(hub.slug);
    const nextFollowing = !hub.following;
    setItems((current) =>
      current.map((item) =>
        item.slug === hub.slug
          ? {
              ...item,
              following: nextFollowing,
              followerCount: Math.max(0, item.followerCount + (nextFollowing ? 1 : -1)),
              memberCount: Math.max(0, item.memberCount + (nextFollowing ? 1 : -1)),
            }
          : item,
      ),
    );
    try {
      const state = await setHubFollow(hub.slug, hub.following);
      setItems((current) =>
        current.map((item) =>
          item.slug === hub.slug
            ? { ...item, following: state.following, followerCount: state.followers, memberCount: state.followers }
            : item,
        ),
      );
      show(state.following ? `Following ${hub.name}` : `Unfollowed ${hub.name}`);
    } catch (error) {
      setItems((current) =>
        current.map((item) =>
          item.slug === hub.slug
            ? {
                ...item,
                following: hub.following,
                followerCount: hub.followerCount,
                memberCount: hub.memberCount,
              }
            : item,
        ),
      );
      show(error instanceof Error ? error.message : "Could not update that follow.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <section className="discover-hero">
        <div>
          <p className="discover-kicker">
            <span /> Sidelines / Club directory <b>{"///"}</b>
          </p>
          <h1>
            Find your
            <br />
            <em>home court.</em>
          </h1>
          <p className="discover-hero-copy">
            Browse SportsHubs, follow your club, join open play and book a court — all in one
            place.
          </p>
        </div>
        <div className="discover-hero-stats">
          <span>
            <b>{items.length}</b> SportsHubs
          </span>
          <span>
            <b>{cities.size}</b> cities
          </span>
          <span>
            <b>{ownedCount || followedCount}</b> {ownedCount ? "yours" : "followed"}
          </span>
        </div>
      </section>

      <section className="discover-search-card" aria-labelledby="hub-search-label">
        <label id="hub-search-label" htmlFor="hub-search" className="discover-search-label">
          Search SportsHubs
        </label>
        <div className="discover-search-row">
          <div className="discover-search">
            <SearchIcon size={20} />
            <input
              id="hub-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                syncUrl({ q: event.target.value });
              }}
              placeholder="Search by name or location…"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  syncUrl({ q: "" });
                }}
                className="discover-search-clear"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
          <div className="discover-view-toggle" role="group" aria-label="Result layout">
            <button
              type="button"
              aria-pressed={view === "list"}
              className={view === "list" ? "is-active" : ""}
              onClick={() => {
                setView("list");
                syncUrl({ view: "list" });
              }}
            >
              <ListIcon size={16} /> List
            </button>
            <button
              type="button"
              aria-pressed={view === "map"}
              className={view === "map" ? "is-active" : ""}
              onClick={() => {
                setView("map");
                syncUrl({ view: "map" });
              }}
            >
              <MapIcon size={16} /> Map
            </button>
          </div>
        </div>
      </section>

      <div className="discover-toolbar">
        <p aria-live="polite">
          <strong>{filtered.length}</strong> SportsHub{filtered.length === 1 ? "" : "s"}
          {query.trim() && <span> matching “{query.trim()}”</span>}
        </p>
        <div className="discover-filter" role="group" aria-label="Filter SportsHubs">
          <button
            type="button"
            aria-pressed={filter === "all"}
            className={filter === "all" ? "is-active" : ""}
            onClick={() => {
              setFilter("all");
              syncUrl({ filter: "all" });
            }}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={filter === "followed"}
            className={filter === "followed" ? "is-active" : ""}
            onClick={() => {
              setFilter("followed");
              syncUrl({ filter: "followed" });
            }}
          >
            Followed
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="discover-empty">
          <CourtIcon size={34} />
          <h2>{filter === "followed" ? "No followed SportsHubs yet" : "No SportsHubs match that search"}</h2>
          <p>
            {filter === "followed"
              ? "Follow a club from the directory and it will wait for you here."
              : "Try a city, a club name, or a street — or clear the search to see everything."}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
              syncUrl({ q: "", filter: "all" });
            }}
          >
            Show every SportsHub
          </button>
        </div>
      ) : view === "list" ? (
        <div className="discover-grid">
          {filtered.map((hub) => (
            <HubCardView
              key={hub.slug}
              hub={hub}
              basePath={basePath}
              busy={busy === hub.slug}
              onFollow={() => void toggleFollow(hub)}
            />
          ))}
        </div>
      ) : (
        <HubMap
          hubs={filtered}
          basePath={basePath}
          busy={busy}
          onFollow={(hub) => void toggleFollow(hub)}
        />
      )}

      {node}
    </>
  );
}

function HubCardView({
  hub,
  basePath,
  busy,
  onFollow,
}: {
  hub: HubCard;
  basePath: DiscoverBasePath;
  busy: boolean;
  onFollow: () => void;
}) {
  const style = {
    "--hub-cover": hub.coverColor,
    "--hub-logo": hub.logoColor,
  } as CSSProperties;

  return (
    <article className="discover-card" style={style}>
      <Link href={`${basePath}/${hub.slug}`} className="discover-card-link">
        <div className="discover-card-cover">
          <span className="discover-card-courtlines" aria-hidden="true" />
          <span className="discover-card-monogram">{hub.monogram}</span>
          {hub.ownedByViewer ? (
            <span className="discover-own">Your club</span>
          ) : (
            hub.comingSoon && <span className="discover-coming">Coming soon</span>
          )}
        </div>
        <div className="discover-card-body">
          <span className="discover-card-logo">{hub.monogram}</span>
          <div className="min-w-0">
            <h2>{hub.name}</h2>
            <p className="discover-card-address">
              <PinIcon size={14} />
              <span>{hub.address || `${hub.city}, ${hub.country}`}</span>
            </p>
            <p className="discover-card-meta">
              <UsersIcon size={14} /> {hub.memberCount.toLocaleString()} members
              <span aria-hidden="true">·</span>
              <CourtIcon size={14} /> {hub.courtCount} court{hub.courtCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </Link>
      {hub.ownedByViewer ? (
        <span className="discover-own-pill">
          <CheckIcon size={15} /> Your club
        </span>
      ) : (
        <button
          type="button"
          onClick={onFollow}
          disabled={busy}
          aria-pressed={hub.following}
          className={`discover-follow ${hub.following ? "is-following" : ""}`}
        >
          <HeartIcon size={15} filled={hub.following} />
          {busy ? "Saving…" : hub.following ? "Following" : "Follow"}
        </button>
      )}
    </article>
  );
}

function HubMap({
  hubs,
  basePath,
  busy,
  onFollow,
}: {
  hubs: HubCard[];
  basePath: DiscoverBasePath;
  busy: string;
  onFollow: (hub: HubCard) => void;
}) {
  const mapped = hubs.filter((hub) => hub.lat !== null && hub.lng !== null);
  const [selected, setSelected] = useState(mapped[0]?.slug ?? "");
  const active = mapped.find((hub) => hub.slug === selected) ?? mapped[0];

  if (mapped.length === 0) {
    return (
      <div className="discover-empty">
        <MapIcon size={34} />
        <h2>No mapped SportsHubs here</h2>
        <p>These results have no map location yet. Switch back to List to browse them.</p>
      </div>
    );
  }

  const lats = mapped.map((hub) => hub.lat as number);
  const lngs = mapped.map((hub) => hub.lng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;

  const position = (hub: HubCard) => ({
    left: `${8 + (((hub.lng as number) - minLng) / lngSpan) * 84}%`,
    top: `${10 + (1 - ((hub.lat as number) - minLat) / latSpan) * 76}%`,
  });

  return (
    <div className="discover-map-wrap">
      <div className="discover-map" role="group" aria-label="Map of SportsHubs">
        <span className="discover-map-water" aria-hidden="true" />
        <span className="discover-map-road discover-map-road-a" aria-hidden="true" />
        <span className="discover-map-road discover-map-road-b" aria-hidden="true" />
        <span className="discover-map-road discover-map-road-c" aria-hidden="true" />
        <span className="discover-map-label discover-map-label-a">LUZON</span>
        <span className="discover-map-label discover-map-label-b">VISAYAS</span>
        <span className="discover-map-label discover-map-label-c">MINDANAO</span>
        {mapped.map((hub) => (
          <button
            key={hub.slug}
            type="button"
            className={`discover-pin ${active?.slug === hub.slug ? "is-active" : ""} ${hub.comingSoon ? "is-soon" : ""}`}
            style={position(hub)}
            onClick={() => setSelected(hub.slug)}
            aria-pressed={active?.slug === hub.slug}
            aria-label={`${hub.name}, ${hub.city}`}
          >
            <span className="discover-pin-dot" />
            <span className="discover-pin-label">
              {hub.name}
              <small>{hub.city}</small>
            </span>
          </button>
        ))}
        <span className="discover-map-compass" aria-hidden="true">
          N
        </span>
      </div>

      {active && (
        <div className="discover-map-card">
          <div>
            <p className="discover-map-card-kicker">
              {active.ownedByViewer ? "Your club" : active.comingSoon ? "Opening soon" : "SportsHub"}
            </p>
            <h2>{active.name}</h2>
            <p>
              <PinIcon size={14} /> {active.address || `${active.city}, ${active.country}`}
            </p>
            <p>
              <UsersIcon size={14} /> {active.memberCount.toLocaleString()} members
              <span aria-hidden="true">·</span>
              <CourtIcon size={14} /> {active.courtCount} courts
            </p>
          </div>
          <div className="discover-map-card-actions">
            {active.ownedByViewer ? (
              <span className="discover-own-pill">
                <CheckIcon size={15} /> Your club
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onFollow(active)}
                disabled={busy === active.slug}
                aria-pressed={active.following}
                className={`discover-follow ${active.following ? "is-following" : ""}`}
              >
                <HeartIcon size={15} filled={active.following} />
                {busy === active.slug ? "Saving…" : active.following ? "Following" : "Follow"}
              </button>
            )}
            <Link href={`${basePath}/${active.slug}`} className="discover-map-open">
              Open hub <ArrowUpRightIcon size={15} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
