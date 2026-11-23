"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useToast } from "@/components/dashboard/use-toast";
import {
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CourtIcon,
  HeartIcon,
  MailIcon,
  MessageIcon,
  NewsIcon,
  PhoneIcon,
  PhotoIcon,
  PinIcon,
  SparkIcon,
  UsersIcon,
} from "@/components/discover/icons";
import { PlayersIcon, TicketIcon } from "@/components/stats/icons";
import {
  addDays,
  dayChip,
  formatHour,
  formatHoursRange,
  formatPeso,
  isoDate,
  longDate,
  MAX_OPEN_PLAY_PLAYERS,
  OPEN_PLAY_CONVENIENCE_FEE,
  relativeNewsDate,
  shortDate,
  weekdayOf,
  DAY_NAMES,
  type DiscoverBasePath,
  type HubCourtGrid,
  type HubDetail,
  type HubOpenPlaySession,
  type HubVoucher,
} from "@/lib/hubs";
import {
  bookCourt,
  bookOpenPlay,
  cancelCourtBooking,
  createVoucher,
  fetchCourtGrid,
  sendHubMessage,
  setHubFollow,
  setOpenPlayJoin,
  setVoucherActive,
  validateVoucher,
} from "@/lib/hubs-client";

const TABS = ["About", "Open Play", "Book a Court", "Photos", "Events", "News"] as const;
type Tab = (typeof TABS)[number];

const WEEK_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function HubDetailView({ hub, basePath }: { hub: HubDetail; basePath: DiscoverBasePath }) {
  const [tab, setTab] = useState<Tab>("About");
  const [following, setFollowing] = useState(hub.following);
  const [followers, setFollowers] = useState(hub.followerCount);
  const [followBusy, setFollowBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [sessions, setSessions] = useState(hub.openPlay);
  const [openBusy, setOpenBusy] = useState("");
  const [grid, setGrid] = useState<HubCourtGrid>(hub.initialCourtGrid);
  const [bookingDate, setBookingDate] = useState(hub.initialCourtGrid.date);
  const [gridLoading, setGridLoading] = useState(false);
  const [bookingBusy, setBookingBusy] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Checkout state — one booking at a time, opened from a Join Game button.
  const [checkout, setCheckout] = useState<HubOpenPlaySession | null>(null);
  const [playerCount, setPlayerCount] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number } | null>(null);
  const [voucherNote, setVoucherNote] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  // The owner's discount codes, editable on their own hub page.
  const [vouchers, setVouchers] = useState<HubVoucher[]>(hub.vouchers);
  const [voucherForm, setVoucherForm] = useState({ code: "", kind: "percent" as "percent" | "amount", value: 25 });
  const [voucherPanelBusy, setVoucherPanelBusy] = useState("");
  const { show, node } = useToast();

  const today = isoDate();
  const openDays = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(today, index)),
    [today],
  );
  const initialOpenDate =
    hub.openPlay.find((session) => session.date === today)?.date ?? hub.openPlay[0]?.date ?? today;
  const [selectedOpenDate, setSelectedOpenDate] = useState(initialOpenDate);
  const sessionDays = useMemo(() => new Set(sessions.map((session) => session.date)), [sessions]);
  const daySessions = sessions
    .filter((session) => session.date === selectedOpenDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const todayHours = hub.hours.find((entry) => entry.day === DAY_NAMES[weekdayOf(today)]);
  const orderedHours = [...hub.hours].sort(
    (a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day),
  );
  const bookingDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(today, index)),
    [today],
  );
  const slotTimes = grid.courts[0]?.slots ?? [];
  const activePhoto = lightbox === null ? null : hub.photos[lightbox];

  useEffect(() => {
    if (!messageOpen && lightbox === null && checkout === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMessageOpen(false);
        setLightbox(null);
        setCheckout(null);
        return;
      }
      if (lightbox !== null && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        setLightbox((index) =>
          index === null ? null : (index + delta + hub.photos.length) % hub.photos.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [messageOpen, lightbox, checkout, hub.photos.length]);

  const toggleFollow = async () => {
    if (followBusy || hub.ownedByViewer) return;
    setFollowBusy(true);
    const previous = following;
    setFollowing(!previous);
    setFollowers((count) => Math.max(0, count + (previous ? -1 : 1)));
    try {
      const state = await setHubFollow(hub.slug, previous);
      setFollowing(state.following);
      setFollowers(state.followers);
      show(state.following ? `Following ${hub.name}` : `Unfollowed ${hub.name}`);
    } catch (error) {
      setFollowing(previous);
      setFollowers((count) => Math.max(0, count + (previous ? 1 : -1)));
      show(error instanceof Error ? error.message : "Could not update that follow.");
    } finally {
      setFollowBusy(false);
    }
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (messageBusy) return;
    setMessageBusy(true);
    try {
      await sendHubMessage(hub.slug, messageBody);
      setMessageOpen(false);
      setMessageBody("");
      show(`Message sent to ${hub.name}`);
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not send that message.");
    } finally {
      setMessageBusy(false);
    }
  };

  const toggleOpenPlay = async (session: HubOpenPlaySession) => {
    if (openBusy || hub.ownedByViewer) return;
    // Paid sessions join through the checkout; free ones stay one click.
    if (!session.joined && session.priceValue !== null) {
      setPlayerCount(1);
      setGuestNames([]);
      setVoucherCode("");
      setAppliedVoucher(null);
      setVoucherNote("");
      setAgree(false);
      setCheckout(session);
      return;
    }
    if (session.joined && session.myPlayers > 1) {
      const confirmed = window.confirm(
        `Cancel your booking (${session.myPlayers} seats)? The convenience fee is not refunded.`,
      );
      if (!confirmed) return;
    }
    setOpenBusy(session.id);
    try {
      const next = await setOpenPlayJoin(hub.slug, session);
      setSessions((current) => current.map((item) => (item.id === next.id ? next : item)));
      show(
        next.joined
          ? `You're in for ${session.title}`
          : `Booking cancelled for ${session.title}`,
      );
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not update that session.");
    } finally {
      setOpenBusy("");
    }
  };

  /** The seat stepper; re-prices an applied voucher for the new count. */
  const changePlayerCount = (delta: number) => {
    if (!checkout) return;
    const max = Math.min(MAX_OPEN_PLAY_PLAYERS, Math.max(1, checkout.spotsLeft + 1));
    const next = Math.min(max, Math.max(1, playerCount + delta));
    if (next === playerCount) return;
    setPlayerCount(next);
    setGuestNames((names) => {
      const need = next - 1;
      if (names.length >= need) return names.slice(0, need);
      return [...names, ...Array.from({ length: need - names.length }, () => "")];
    });
    if (appliedVoucher) {
      validateVoucher(hub.slug, { templateId: checkout.templateId, playerCount: next, code: appliedVoucher.code })
        .then((quote) => {
          setAppliedVoucher(quote.voucherApplied ? { code: quote.voucherCode, discount: quote.discount } : null);
          setVoucherNote(quote.voucherMessage);
        })
        .catch(() => {
          /* the confirm step re-validates; keep the screen responsive */
        });
    }
  };

  const applyVoucher = async () => {
    if (!checkout || !voucherCode.trim()) return;
    try {
      const quote = await validateVoucher(hub.slug, {
        templateId: checkout.templateId,
        playerCount,
        code: voucherCode,
      });
      setAppliedVoucher(quote.voucherApplied ? { code: quote.voucherCode, discount: quote.discount } : null);
      setVoucherNote(quote.voucherMessage || (quote.voucherApplied ? "Applied" : "That code is not valid here."));
    } catch (error) {
      setAppliedVoucher(null);
      setVoucherNote(error instanceof Error ? error.message : "Could not check that code.");
    }
  };

  const confirmCheckout = async () => {
    if (!checkout || checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const { session, order } = await bookOpenPlay(hub.slug, {
        templateId: checkout.templateId,
        date: checkout.date,
        players: guestNames.slice(0, Math.max(0, playerCount - 1)).map((name) => name.trim()),
        voucherCode: appliedVoucher?.code ?? "",
      });
      setSessions((current) => current.map((item) => (item.id === session.id ? session : item)));
      setCheckout(null);
      show(
        order
          ? `Booked ${order.playerCount} ${order.playerCount === 1 ? "seat" : "seats"} · ${formatPeso(order.total)} paid`
          : `You're in for ${session.title}`,
      );
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not complete that booking.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const submitVoucher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (voucherPanelBusy) return;
    setVoucherPanelBusy("create");
    try {
      const voucher = await createVoucher(hub.slug, voucherForm);
      setVouchers((current) => [voucher, ...current]);
      setVoucherForm((form) => ({ ...form, code: "" }));
      show(`Voucher ${voucher.code} is live`);
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not create that voucher.");
    } finally {
      setVoucherPanelBusy("");
    }
  };

  const toggleVoucher = async (voucher: HubVoucher) => {
    if (voucherPanelBusy) return;
    setVoucherPanelBusy(voucher.id);
    try {
      const next = await setVoucherActive(hub.slug, voucher.id, !voucher.active);
      setVouchers((current) => current.map((item) => (item.id === next.id ? next : item)));
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not update that voucher.");
    } finally {
      setVoucherPanelBusy("");
    }
  };

  const loadGrid = async (date: string) => {
    if (date === bookingDate || gridLoading) return;
    setBookingDate(date);
    setGridLoading(true);
    try {
      setGrid(await fetchCourtGrid(hub.slug, date));
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not load that day.");
    } finally {
      setGridLoading(false);
    }
  };

  const bookSlot = async (courtId: string, startTime: string) => {
    const key = `${courtId}:${startTime}`;
    if (bookingBusy) return;
    setBookingBusy(key);
    try {
      const result = await bookCourt(hub.slug, { courtId, date: bookingDate, startTime });
      setGrid(result.grid);
      show(`Booked ${formatHour(startTime)} on ${shortDate(bookingDate)}`);
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not book that slot.");
    } finally {
      setBookingBusy("");
    }
  };

  const cancelSlot = async (bookingId: string) => {
    if (bookingBusy) return;
    setBookingBusy(bookingId);
    try {
      setGrid(await cancelCourtBooking(hub.slug, bookingId, bookingDate));
      show("Booking cancelled");
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not cancel that booking.");
    } finally {
      setBookingBusy("");
    }
  };

  const moveTab = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + delta + TABS.length) % TABS.length;
    setTab(TABS[next]);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
    tabs?.[next]?.focus();
  };

  const heroStyle = {
    "--hub-cover": hub.coverColor,
    "--hub-logo": hub.logoColor,
  } as CSSProperties;

  const checkoutQuote = useMemo(() => {
    if (!checkout || checkout.priceValue === null) return null;
    const subtotal = checkout.priceValue * playerCount;
    const discount = Math.min(appliedVoucher?.discount ?? 0, subtotal);
    return {
      subtotal,
      discount,
      total: subtotal - discount + OPEN_PLAY_CONVENIENCE_FEE,
    };
  }, [checkout, playerCount, appliedVoucher]);

  return (
    <>
      <div className="hub-detail">
        <Link href={basePath} className="hub-back">
          <ChevronLeftIcon size={16} /> Discover
        </Link>

        <header className="hub-hero" style={heroStyle}>
          <div className="hub-hero-cover">
            <span className="hub-hero-lines" aria-hidden="true" />
            <span className="hub-hero-monogram" aria-hidden="true">
              {hub.monogram}
            </span>
            <div className="hub-hero-stamp">
              <SparkIcon size={14} />
              {hub.ownedByViewer
                ? "Your SportsHub"
                : hub.comingSoon
                  ? "Opening soon"
                  : "SportsHub"}
            </div>
          </div>

          <div className="hub-hero-body">
            <span className="hub-hero-logo">{hub.monogram}</span>
            <div className="hub-hero-copy">
              <p className="hub-hero-kicker">
                {hub.city}
                {hub.country ? `, ${hub.country}` : ""}
              </p>
              <h1>{hub.name}</h1>
              <p className="hub-hero-address">
                <PinIcon size={15} />
                {hub.address || `${hub.city}, ${hub.country}`}
              </p>
              <p className="hub-hero-meta">
                <UsersIcon size={15} /> <b>{followers.toLocaleString()}</b> members
                <span aria-hidden="true">·</span>
                <CourtIcon size={15} /> <b>{hub.courtCount}</b> court
                {hub.courtCount === 1 ? "" : "s"}
                <span aria-hidden="true">·</span>
                <ClockIcon size={15} />
                {todayHours && !todayHours.closed
                  ? `Today ${formatHoursRange(todayHours.open, todayHours.close)}`
                  : "Closed today"}
              </p>
            </div>
            <div className="hub-hero-actions">
              {hub.ownedByViewer ? (
                <p className="hub-owner-note">
                  <CheckIcon size={16} /> Your club&rsquo;s public page — this is what players see
                  in Discover.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    className={`hub-action hub-action-follow ${following ? "is-following" : ""}`}
                    onClick={() => void toggleFollow()}
                    disabled={followBusy}
                    aria-pressed={following}
                  >
                    <HeartIcon size={16} filled={following} />
                    {followBusy ? "Saving…" : following ? "Following" : "Follow"}
                  </button>
                  <button
                    type="button"
                    className="hub-action hub-action-message"
                    onClick={() => setMessageOpen(true)}
                  >
                    <MessageIcon size={16} /> Message
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <nav className="hub-tabs" aria-label={`${hub.name} sections`}>
          <div role="tablist" aria-label="SportsHub sections">
            {TABS.map((item, index) => (
              <button
                key={item}
                type="button"
                role="tab"
                id={`hub-tab-${slugify(item)}`}
                aria-selected={tab === item}
                aria-controls={`hub-panel-${slugify(item)}`}
                tabIndex={tab === item ? 0 : -1}
                className={tab === item ? "is-active" : ""}
                onClick={() => setTab(item)}
                onKeyDown={(event) => moveTab(event, index)}
              >
                {item}
                {item === "Open Play" && sessions.length > 0 && (
                  <span className="hub-tab-count">{sessions.length}</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        <div
          className="hub-panel-wrap"
          role="tabpanel"
          id={`hub-panel-${slugify(tab)}`}
          aria-labelledby={`hub-tab-${slugify(tab)}`}
          tabIndex={0}
        >
          {tab === "About" && (
            <div className="hub-about-grid">
              <article className="hub-panel hub-about">
                <p className="hub-panel-kicker">About the club</p>
                <h2>{hub.name}</h2>
                <p className="hub-about-copy">{hub.about || "This SportsHub has not written an introduction yet."}</p>

                <div className="hub-about-stats">
                  <div>
                    <b>{followers.toLocaleString()}</b>
                    <span>Members</span>
                  </div>
                  <div>
                    <b>{hub.courtCount}</b>
                    <span>Courts</span>
                  </div>
                  <div>
                    <b>{sessions.length}</b>
                    <span>Open plays</span>
                  </div>
                  <div>
                    <b>{hub.events.length}</b>
                    <span>Events</span>
                  </div>
                </div>

                {hub.courts.length > 0 && (
                  <div className="hub-court-list">
                    <p className="hub-panel-kicker">Courts</p>
                    <ul>
                      {hub.courts.map((court) => (
                        <li key={court.id}>
                          <span>
                            <CourtIcon size={15} /> {court.name}
                          </span>
                          <span>
                            {court.surface}
                            {court.indoor ? " · Indoor" : ""}
                            {court.hourlyRate ? ` · ${court.hourlyRate}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>

              <aside className="hub-side">
                <section className="hub-panel">
                  <div className="hub-panel-head">
                    <p className="hub-panel-kicker">Operating hours</p>
                    <ClockIcon size={16} />
                  </div>
                  <p className="hub-today-hours">
                    {todayHours && !todayHours.closed
                      ? formatHoursRange(todayHours.open, todayHours.close)
                      : "Closed today"}
                  </p>
                  <ul className="hub-hours">
                    {orderedHours.map((entry) => (
                      <li
                        key={entry.day}
                        className={entry.day === DAY_NAMES[weekdayOf(today)] ? "is-today" : ""}
                      >
                        <span>{entry.day}</span>
                        <span>{entry.closed ? "Closed" : formatHoursRange(entry.open, entry.close)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="hub-panel">
                  <div className="hub-panel-head">
                    <p className="hub-panel-kicker">Contact</p>
                    <PhoneIcon size={16} />
                  </div>
                  <ul className="hub-contact">
                    {hub.phone && (
                      <li>
                        <PhoneIcon size={15} />
                        <a href={`tel:${hub.phone.replace(/\s+/g, "")}`}>{hub.phone}</a>
                      </li>
                    )}
                    {hub.email && (
                      <li>
                        <MailIcon size={15} />
                        <a href={`mailto:${hub.email}`}>{hub.email}</a>
                      </li>
                    )}
                    <li>
                      <PinIcon size={15} />
                      <span>{hub.address || `${hub.city}, ${hub.country}`}</span>
                    </li>
                  </ul>
                  {!hub.ownedByViewer && (
                    <button
                      type="button"
                      className="hub-side-message"
                      onClick={() => setMessageOpen(true)}
                    >
                      <MessageIcon size={15} /> Send a message
                    </button>
                  )}
                </section>
              </aside>
            </div>
          )}

          {tab === "Open Play" && (
            <section className="hub-section">
              <div className="hub-section-head">
                <div>
                  <p className="hub-panel-kicker">Weekly socials</p>
                  <h2>Open play</h2>
                </div>
                <p>Pick a day, join a session, and meet the club. Spots are per session.</p>
              </div>

              {hub.ownedByViewer && (
                <section className="hub-panel voucher-panel" aria-labelledby="voucher-heading">
                  <div className="hub-panel-head">
                    <p className="hub-panel-kicker" id="voucher-heading">
                      Vouchers
                    </p>
                    <TicketIcon size={16} />
                  </div>
                  <p className="voucher-copy">
                    Players can apply these codes at checkout for your paid sessions.
                  </p>
                  {vouchers.length > 0 && (
                    <ul className="voucher-list">
                      {vouchers.map((voucher) => (
                        <li key={voucher.id} className={voucher.active ? "" : "is-off"}>
                          <span className="voucher-code">
                            <TicketIcon size={14} /> {voucher.code}
                          </span>
                          <span className="voucher-value">
                            {voucher.kind === "percent" ? `${voucher.value}% off` : `${formatPeso(voucher.value)} off`}
                          </span>
                          <button
                            type="button"
                            onClick={() => void toggleVoucher(voucher)}
                            disabled={voucherPanelBusy === voucher.id}
                          >
                            {voucherPanelBusy === voucher.id ? "…" : voucher.active ? "Pause" : "Activate"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form className="voucher-form" onSubmit={(event) => void submitVoucher(event)}>
                    <input
                      value={voucherForm.code}
                      onChange={(event) =>
                        setVoucherForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))
                      }
                      placeholder="CODE"
                      maxLength={20}
                      aria-label="Voucher code"
                      required
                    />
                    <select
                      value={voucherForm.kind}
                      onChange={(event) =>
                        setVoucherForm((form) => ({
                          ...form,
                          kind: event.target.value === "amount" ? "amount" : "percent",
                        }))
                      }
                      aria-label="Discount type"
                    >
                      <option value="percent">% off</option>
                      <option value="amount">₱ off</option>
                    </select>
                    <input
                      value={voucherForm.value}
                      onChange={(event) =>
                        setVoucherForm((form) => ({ ...form, value: Number(event.target.value) || 0 }))
                      }
                      type="number"
                      min={1}
                      max={voucherForm.kind === "percent" ? 100 : 100000}
                      aria-label="Discount value"
                      required
                    />
                    <button type="submit" className="voucher-publish" disabled={voucherPanelBusy === "create"}>
                      {voucherPanelBusy === "create" ? "Publishing…" : "Publish"}
                    </button>
                  </form>
                </section>
              )}

              <div className="hub-day-strip" role="group" aria-label="Open play date">
                {openDays.map((date) => {
                  const chip = dayChip(date);
                  const hasSessions = sessionDays.has(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      className={`hub-day ${selectedOpenDate === date ? "is-active" : ""} ${hasSessions ? "has-sessions" : ""}`}
                      onClick={() => setSelectedOpenDate(date)}
                      aria-pressed={selectedOpenDate === date}
                    >
                      <span>{chip.weekday}</span>
                      <b>{chip.number}</b>
                      <span>{chip.month}</span>
                      {hasSessions && <i aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              <p className="hub-selected-date">{longDate(selectedOpenDate)}</p>

              {daySessions.length === 0 ? (
                <div className="hub-empty">
                  <CalendarIcon size={30} />
                  <h3>No open play on this day</h3>
                  <p>Pick another date — days with a lime dot have sessions.</p>
                </div>
              ) : (
                <div className="hub-openplay-list">
                  {daySessions.map((session) => {
                    const full = session.spotsLeft === 0 && !session.joined;
                    return (
                      <article
                        key={session.id}
                        className={`hub-openplay ${session.joined ? "is-joined" : ""}`}
                      >
                        <div className="hub-openplay-time">
                          <b>{formatHour(session.startTime)}</b>
                          <span>{formatHour(session.endTime)}</span>
                        </div>
                        <div className="hub-openplay-body">
                          <h3>{session.title}</h3>
                          <p>
                            <CourtIcon size={14} /> {session.court || "All courts"}
                            <span aria-hidden="true">·</span>
                            <SparkIcon size={14} /> {session.level}
                          </p>
                          <div className="hub-capacity">
                            <span>
                              {session.taken}/{session.capacity} joined
                            </span>
                            <span>{full ? "Full" : `${session.spotsLeft} spots left`}</span>
                            <i>
                              <b
                                style={{
                                  width: `${Math.min(100, Math.round((session.taken / Math.max(1, session.capacity)) * 100))}%`,
                                }}
                              />
                            </i>
                          </div>
                        </div>
                        <div className="hub-openplay-action">
                          <span className="hub-price">{session.price || "Free"}</span>
                          {hub.ownedByViewer ? (
                            <span className="hub-own-tag">Your session</span>
                          ) : session.joined ? (
                            <button
                              type="button"
                              className="hub-join is-joined"
                              onClick={() => void toggleOpenPlay(session)}
                              disabled={openBusy === session.id}
                            >
                              {openBusy === session.id
                                ? "Saving…"
                                : session.myPlayers > 1
                                  ? `Joined · ${session.myPlayers}`
                                  : "Joined"}
                              <CheckIcon size={14} />
                            </button>
                          ) : session.priceValue !== null ? (
                            <button
                              type="button"
                              className="hub-join is-paid"
                              onClick={() => toggleOpenPlay(session)}
                              disabled={openBusy === session.id || full}
                            >
                              {full ? "Full" : "Join Game"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`hub-join ${session.joined ? "is-joined" : ""}`}
                              onClick={() => void toggleOpenPlay(session)}
                              disabled={openBusy === session.id || full}
                            >
                              {openBusy === session.id ? "Saving…" : full ? "Full" : "Join"}
                              {session.joined && <CheckIcon size={14} />}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === "Book a Court" && (
            <section className="hub-section">
              <div className="hub-section-head">
                <div>
                  <p className="hub-panel-kicker">Reserve a slot</p>
                  <h2>Book a court</h2>
                </div>
                <p>
                  {hub.comingSoon
                    ? "This SportsHub is not taking bookings yet."
                    : "One-hour slots. Lime is open, ink is taken, and your own bookings are outlined."}
                </p>
              </div>

              <div className="hub-day-strip" role="group" aria-label="Booking date">
                {bookingDays.map((date) => {
                  const chip = dayChip(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      className={`hub-day ${bookingDate === date ? "is-active" : ""}`}
                      onClick={() => void loadGrid(date)}
                      aria-pressed={bookingDate === date}
                      disabled={gridLoading}
                    >
                      <span>{chip.weekday}</span>
                      <b>{chip.number}</b>
                      <span>{chip.month}</span>
                    </button>
                  );
                })}
              </div>

              <div className="hub-booking-head">
                <p className="hub-selected-date">{longDate(bookingDate)}</p>
                <div className="hub-legend">
                  <span>
                    <i className="is-open" /> Open
                  </span>
                  <span>
                    <i className="is-booked" /> Taken
                  </span>
                  <span>
                    <i className="is-mine" /> Yours
                  </span>
                </div>
              </div>

              {grid.courts.length === 0 ? (
                <div className="hub-empty">
                  <CourtIcon size={30} />
                  <h3>No courts listed yet</h3>
                  <p>This SportsHub has not published its courts. Send them a message to ask.</p>
                </div>
              ) : !grid.hours ? (
                <div className="hub-empty">
                  <ClockIcon size={30} />
                  <h3>Closed on this date</h3>
                  <p>Pick another day to see the court grid.</p>
                </div>
              ) : (
                <div className={`hub-booking ${gridLoading ? "is-loading" : ""}`}>
                  <div
                    className="hub-booking-grid"
                    style={{
                      gridTemplateColumns: `4.5rem repeat(${grid.courts.length}, minmax(7.5rem, 1fr))`,
                    }}
                  >
                    <div className="hub-booking-corner">Time</div>
                    {grid.courts.map((court) => (
                      <div key={court.id} className="hub-booking-court">
                        <b>{court.name}</b>
                        <span>{court.hourlyRate || court.surface}</span>
                      </div>
                    ))}

                    {slotTimes.map((slot, slotIndex) => (
                      <div key={slot.start} className="hub-booking-row">
                        <div className="hub-booking-time">{formatHour(slot.start)}</div>
                        {grid.courts.map((court) => {
                          const cell = court.slots[slotIndex];
                          if (!cell) {
                            return <div key={court.id} className="hub-slot is-empty" />;
                          }
                          if (cell.status === "booked") {
                            return (
                              <div key={court.id} className="hub-slot is-booked">
                                Taken
                              </div>
                            );
                          }
                          if (cell.status === "mine") {
                            return (
                              <button
                                key={court.id}
                                type="button"
                                className="hub-slot is-mine"
                                onClick={() => cell.bookingId && void cancelSlot(cell.bookingId)}
                                disabled={bookingBusy === cell.bookingId}
                              >
                                {bookingBusy === cell.bookingId ? "…" : "Yours"}
                                <span>cancel</span>
                              </button>
                            );
                          }
                          return (
                            <button
                              key={court.id}
                              type="button"
                              className="hub-slot is-open"
                              onClick={() => void bookSlot(court.id, cell.start)}
                              disabled={bookingBusy === `${court.id}:${cell.start}` || hub.comingSoon}
                            >
                              {bookingBusy === `${court.id}:${cell.start}` ? "…" : "Book"}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "Photos" && (
            <section className="hub-section">
              <div className="hub-section-head">
                <div>
                  <p className="hub-panel-kicker">Around the club</p>
                  <h2>Photos</h2>
                </div>
                <p>{hub.photos.length} frames from the courts, the clubhouse and match nights.</p>
              </div>

              {hub.photos.length === 0 ? (
                <div className="hub-empty">
                  <PhotoIcon size={30} />
                  <h3>No photos yet</h3>
                  <p>The club has not posted any photos.</p>
                </div>
              ) : (
                <div className="hub-photo-grid">
                  {hub.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      className={`hub-photo hub-photo-${index % 5}`}
                      style={{ "--photo": photo.color } as CSSProperties}
                      onClick={() => setLightbox(index)}
                    >
                      <span className="hub-photo-lines" aria-hidden="true" />
                      <span className="hub-photo-caption">{photo.caption}</span>
                      <span className="hub-photo-open">
                        <ArrowUpRightIcon size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "Events" && (
            <section className="hub-section">
              <div className="hub-section-head">
                <div>
                  <p className="hub-panel-kicker">On the calendar</p>
                  <h2>Events</h2>
                </div>
                <p>Tournaments and league days hosted by {hub.name}.</p>
              </div>

              {hub.events.length === 0 ? (
                <div className="hub-empty">
                  <CalendarIcon size={30} />
                  <h3>No events on the board</h3>
                  <p>Follow the hub and its next tournament will appear here.</p>
                </div>
              ) : (
                <div className="hub-event-list">
                  {hub.events.map((event) => {
                    const chip = dayChip(event.start);
                    return (
                      <Link key={event.slug} href={`/events/${event.slug}`} className="hub-event">
                        <span className="hub-event-date">
                          <b>{chip.number}</b>
                          <span>{chip.month}</span>
                        </span>
                        <div className="hub-event-body">
                          <div className="hub-event-top">
                            <h3>{event.name}</h3>
                            {event.live && <span className="hub-event-live">Live</span>}
                          </div>
                          <p>
                            <PinIcon size={14} /> {event.city}, {event.country}
                            <span aria-hidden="true">·</span>
                            <CalendarIcon size={14} /> {shortDate(event.start)}
                            {event.end !== event.start ? ` – ${shortDate(event.end)}` : ""}
                          </p>
                          <div className="hub-event-tags">
                            {event.tags.slice(0, 3).map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <span className="hub-event-arrow">
                          <ArrowUpRightIcon size={18} />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === "News" && (
            <section className="hub-section">
              <div className="hub-section-head">
                <div>
                  <p className="hub-panel-kicker">From the club</p>
                  <h2>News</h2>
                </div>
                <p>Court updates, clinic dates and club notices.</p>
              </div>

              {hub.news.length === 0 ? (
                <div className="hub-empty">
                  <NewsIcon size={30} />
                  <h3>No news yet</h3>
                  <p>Follow the hub for its first announcement.</p>
                </div>
              ) : (
                <div className="hub-news-list">
                  {hub.news.map((item) => (
                    <article key={item.id} className="hub-news">
                      <div className="hub-news-meta">
                        <span>
                          <NewsIcon size={14} /> Club notice
                        </span>
                        <time dateTime={item.publishedAt}>{relativeNewsDate(item.publishedAt)}</time>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {messageOpen && (
        <div
          className="hub-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-message-title"
          onClick={() => setMessageOpen(false)}
        >
          <form
            className="hub-modal-card"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void submitMessage(event)}
          >
            <div className="hub-modal-head">
              <div>
                <p className="hub-panel-kicker">Direct message</p>
                <h2 id="hub-message-title">Message {hub.name}</h2>
              </div>
              <button
                type="button"
                className="hub-modal-close"
                onClick={() => setMessageOpen(false)}
                aria-label="Close message"
              >
                ×
              </button>
            </div>
            <p className="hub-modal-copy">
              Ask about court availability, coaching, or a membership. The club sees your name and
              email with the message.
            </p>
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder={`Hi ${hub.name}, I'd like to ask about…`}
              rows={5}
              maxLength={2000}
              autoFocus
              required
            />
            <div className="hub-modal-foot">
              <span>{messageBody.trim().length}/2000</span>
              <button type="submit" className="hub-modal-send" disabled={messageBusy || messageBody.trim().length < 2}>
                {messageBusy ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activePhoto && (
        <div
          className="hub-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.caption}
          onClick={() => setLightbox(null)}
        >
          <div
            className="hub-lightbox-card"
            style={{ "--photo": activePhoto.color } as CSSProperties}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hub-lightbox-art">
              <span className="hub-photo-lines" aria-hidden="true" />
              <span className="hub-lightbox-mark">{hub.monogram}</span>
            </div>
            <div className="hub-lightbox-bar">
              <p>{activePhoto.caption}</p>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((index) =>
                      index === null ? null : (index - 1 + hub.photos.length) % hub.photos.length,
                    )
                  }
                  aria-label="Previous photo"
                >
                  <ChevronLeftIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((index) =>
                      index === null ? null : (index + 1) % hub.photos.length,
                    )
                  }
                  aria-label="Next photo"
                >
                  <ChevronRightIcon size={18} />
                </button>
                <button type="button" onClick={() => setLightbox(null)} aria-label="Close photo">
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkout && checkoutQuote && (
        <div
          className="hub-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onClick={() => {
            if (!checkoutBusy) setCheckout(null);
          }}
        >
          <div
            className="hub-modal-card hub-checkout"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hub-modal-head">
              <div>
                <p className="hub-panel-kicker">Join game</p>
                <h2 id="checkout-title">{checkout.title}</h2>
              </div>
              <button
                type="button"
                className="hub-modal-close"
                onClick={() => setCheckout(null)}
                aria-label="Close checkout"
                disabled={checkoutBusy}
              >
                ×
              </button>
            </div>
            <p className="hub-modal-copy">
              {longDate(checkout.date)} · {formatHour(checkout.startTime)}–{formatHour(checkout.endTime)} ·{" "}
              {checkout.court || checkout.level}
            </p>

            <div className="checkout-players">
              <div className="checkout-players-head">
                <p className="checkout-players-label">
                  <PlayersIcon size={16} /> Players
                </p>
                <span className="checkout-players-hint">Add up to {MAX_OPEN_PLAY_PLAYERS} players</span>
                <div className="checkout-stepper">
                  <button
                    type="button"
                    onClick={() => changePlayerCount(-1)}
                    disabled={playerCount <= 1}
                    aria-label="Remove a player"
                  >
                    −
                  </button>
                  <b aria-live="polite">{playerCount}</b>
                  <button
                    type="button"
                    onClick={() => changePlayerCount(1)}
                    disabled={playerCount >= MAX_OPEN_PLAY_PLAYERS || playerCount >= checkout.spotsLeft + 1}
                    aria-label="Add a player"
                  >
                    +
                  </button>
                </div>
              </div>
              <ul className="checkout-seat-list">
                <li>
                  <span className="checkout-seat-name">{hub.viewerName ?? "You"} (You)</span>
                  <span className="checkout-seat-tag">Included</span>
                </li>
                {guestNames.map((name, index) => (
                  <li key={index}>
                    <input
                      value={name}
                      onChange={(event) =>
                        setGuestNames((names) =>
                          names.map((item, position) => (position === index ? event.target.value : item)),
                        )
                      }
                      placeholder={`Guest ${index + 1} name`}
                      maxLength={40}
                      aria-label={`Guest ${index + 1} name`}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="checkout-summary">
              <p className="checkout-summary-title">Payment summary</p>
              <div className="checkout-row">
                <span>Session fee ({playerCount} {playerCount === 1 ? "player" : "players"})</span>
                <b>{formatPeso(checkoutQuote.subtotal)}</b>
              </div>
              {checkoutQuote.discount > 0 && (
                <div className="checkout-row is-discount">
                  <span>Voucher {appliedVoucher?.code}</span>
                  <b>−{formatPeso(checkoutQuote.discount)}</b>
                </div>
              )}
              <div className="checkout-voucher">
                <p className="checkout-voucher-label">
                  <TicketIcon size={15} /> Voucher code
                </p>
                <div className="checkout-voucher-row">
                  <input
                    value={voucherCode}
                    onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
                    placeholder="Enter voucher code"
                    maxLength={20}
                    aria-label="Voucher code"
                  />
                  <button
                    type="button"
                    onClick={() => void applyVoucher()}
                    disabled={!voucherCode.trim()}
                  >
                    Apply
                  </button>
                </div>
                {voucherNote && <p className="checkout-voucher-note">{voucherNote}</p>}
              </div>
              <div className="checkout-row">
                <span>+ Convenience fee</span>
                <b>{formatPeso(OPEN_PLAY_CONVENIENCE_FEE)}</b>
              </div>
              <div className="checkout-row is-total">
                <span>Total</span>
                <b>{formatPeso(checkoutQuote.total)}</b>
              </div>
            </div>

            <label className="checkout-agree">
              <input
                type="checkbox"
                checked={agree}
                onChange={(event) => setAgree(event.target.checked)}
              />
              <span>
                I understand that the convenience fee is non-refundable.{" "}
                <small>The convenience fee charged during checkout is non-refundable.</small>
              </span>
            </label>

            <button
              type="button"
              className="checkout-confirm"
              onClick={() => void confirmCheckout()}
              disabled={!agree || checkoutBusy}
            >
              {checkoutBusy
                ? "Booking…"
                : `Confirm Booking – PHP ${checkoutQuote.total.toLocaleString("en-PH")}`}
            </button>
            <button
              type="button"
              className="checkout-cancel"
              onClick={() => setCheckout(null)}
              disabled={checkoutBusy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {node}
    </>
  );
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
