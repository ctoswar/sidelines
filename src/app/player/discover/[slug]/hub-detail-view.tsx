"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
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
import {
  addDays,
  dayChip,
  formatHour,
  formatHoursRange,
  isoDate,
  longDate,
  relativeNewsDate,
  shortDate,
  weekdayOf,
  DAY_NAMES,
  type HubCourtGrid,
  type HubDetail,
  type HubOpenPlaySession,
} from "@/lib/hubs";
import {
  bookCourt,
  cancelCourtBooking,
  fetchCourtGrid,
  sendHubMessage,
  setHubFollow,
  setOpenPlayJoin,
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

export function HubDetailView({ hub }: { hub: HubDetail }) {
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

  const toggleFollow = async () => {
    if (followBusy) return;
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
    if (openBusy) return;
    setOpenBusy(session.id);
    try {
      const next = await setOpenPlayJoin(hub.slug, session);
      setSessions((current) => current.map((item) => (item.id === next.id ? next : item)));
      show(
        next.joined
          ? `You're in for ${session.title}`
          : `Left ${session.title}`,
      );
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not update that session.");
    } finally {
      setOpenBusy("");
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

  const heroStyle = {
    "--hub-cover": hub.coverColor,
    "--hub-logo": hub.logoColor,
  } as CSSProperties;

  return (
    <>
      <div className="hub-detail">
        <Link href="/player/discover" className="hub-back">
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
              {hub.comingSoon ? "Opening soon" : "SportsHub"}
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
            </div>
          </div>
        </header>

        <nav className="hub-tabs" aria-label={`${hub.name} sections`}>
          <div role="tablist" aria-label="SportsHub sections">
            {TABS.map((item) => (
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
                  <button
                    type="button"
                    className="hub-side-message"
                    onClick={() => setMessageOpen(true)}
                  >
                    <MessageIcon size={15} /> Send a message
                  </button>
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
                          <button
                            type="button"
                            className={`hub-join ${session.joined ? "is-joined" : ""}`}
                            onClick={() => void toggleOpenPlay(session)}
                            disabled={openBusy === session.id || full}
                          >
                            {openBusy === session.id
                              ? "Saving…"
                              : session.joined
                                ? "Joined"
                                : full
                                  ? "Full"
                                  : "Join"}
                            {session.joined && <CheckIcon size={14} />}
                          </button>
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

      {node}
    </>
  );
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
