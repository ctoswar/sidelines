// Seed content for the Discover directory.
//
// These are development fixtures in the spirit of src/lib/events-data.ts: they
// make a fresh database look like a real neighbourhood directory instead of an
// empty page. The hub seed script upserts them by slug, so editing a field
// here and re-running `npm run db:seed:hubs` refreshes the listing.
//
// `organizationId` is intentionally absent: these are community hubs, not the
// signed-in organizer's workspace. Claimed organizer hubs are created from
// their organizations separately (see ensureHubForOrganization).

import { defaultHubHours, type HubOperatingHours } from "@/lib/hubs";

export type HubCourtSeed = {
  name: string;
  surface: string;
  indoor: boolean;
  hourlyRate: string;
};

export type HubOpenPlaySeed = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  title: string;
  startTime: string;
  endTime: string;
  court: string;
  level: string;
  capacity: number;
  price: string;
};

export type HubSeed = {
  slug: string;
  name: string;
  about: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  logoColor: string;
  coverColor: string;
  memberCount: number;
  lat: number;
  lng: number;
  comingSoon?: boolean;
  hours?: HubOperatingHours[];
  courts: HubCourtSeed[];
  openPlay: HubOpenPlaySeed[];
  photos: { caption: string; color: string }[];
  news: { title: string; body: string; daysAgo: number }[];
  eventSlugs: string[];
};

const longHours = defaultHubHours().map((entry) => ({
  ...entry,
  open: "06:00",
  close: "01:00",
}));

function courts(count: number, rate = "₱350/hr", indoor = false): HubCourtSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Court ${index + 1}`,
    surface: index === count - 1 ? "Tennis / pickleball" : "Pickleball",
    indoor: indoor && index >= Math.max(0, count - 2),
    hourlyRate: rate,
  }));
}

function socialOpenPlay(prefix: string): HubOpenPlaySeed[] {
  return [
    {
      weekday: 0,
      title: `${prefix} Sunday Rally`,
      startTime: "08:00",
      endTime: "11:00",
      court: "Courts 1–3",
      level: "Beginner friendly",
      capacity: 24,
      price: "₱250",
    },
    {
      weekday: 2,
      title: "Tuesday Night Open Play",
      startTime: "18:00",
      endTime: "21:00",
      court: "Courts 1–4",
      level: "Intermediate",
      capacity: 32,
      price: "₱300",
    },
    {
      weekday: 4,
      title: "Thursday Night Open Play",
      startTime: "18:00",
      endTime: "21:00",
      court: "Courts 1–4",
      level: "All levels",
      capacity: 32,
      price: "₱300",
    },
    {
      weekday: 6,
      title: "Saturday Morning Social",
      startTime: "07:30",
      endTime: "10:30",
      court: "Courts 1–6",
      level: "All levels",
      capacity: 40,
      price: "₱250",
    },
  ];
}

function gallery(colors: string[], captions: string[]): { caption: string; color: string }[] {
  return captions.map((caption, index) => ({
    caption,
    color: colors[index % colors.length],
  }));
}

export const HUB_SEEDS: HubSeed[] = [
  {
    slug: "cebu-pickle-club",
    name: "Cebu Pickle Club",
    about:
      "Welcome to the Cebu Pickle Club! Where pickleball brings us together. Book your court slots, join a social open play, or catch a tournament under the lights. The club runs six courts and a full calendar of beginner clinics.",
    address: "Lot 20, 20 Naga - Uling Rd, Naga, 6037 Cebu",
    city: "Cebu",
    country: "Philippines",
    phone: "09152682506",
    email: "cebupickleclub@gmail.com",
    logoColor: "#c2410c",
    coverColor: "#174f37",
    memberCount: 908,
    lat: 10.2094,
    lng: 123.7583,
    hours: longHours,
    courts: courts(6),
    openPlay: socialOpenPlay("Cebu"),
    photos: gallery(
      ["#174f37", "#c2410c", "#14213d", "#1f6b4a", "#b45309", "#0e7490"],
      [
        "Center court at golden hour",
        "The 6am regulars",
        "Saturday social, full house",
        "Junior clinic on court 4",
        "Finals night under the lights",
        "Clubhouse after the last rally",
      ],
    ),
    news: [
      {
        title: "New court lights land on Courts 5 and 6",
        body: "Evening play now runs until 1am on weekends. The booking grid has been extended and the last slot starts at 11pm.",
        daysAgo: 2,
      },
      {
        title: "Sunday beginner clinic returns",
        body: "Coach Mia opens the doors at 7am for a free 45-minute clinic before Sunday Rally. Paddles are provided.",
        daysAgo: 9,
      },
    ],
    eventSlugs: ["cebu-beach-pickleball-cup", "davao-open-2026"],
  },
  {
    slug: "dens-pickleball-and-tennis-club",
    name: "Den's Pickleball and Tennis Club",
    about:
      "A neighbourhood club with four pickleball courts and two tennis courts. Den's runs a relaxed Tuesday night open play, a competitive ladder, and junior sessions on weekends.",
    address: "Paclas Zone IV, Libon, Albay",
    city: "Libon",
    country: "Philippines",
    phone: "09171234567",
    email: "hello@denspickleball.ph",
    logoColor: "#0e7490",
    coverColor: "#14213d",
    memberCount: 205,
    lat: 13.2965,
    lng: 123.4381,
    courts: courts(4, "₱300/hr"),
    openPlay: socialOpenPlay("Den's"),
    photos: gallery(
      ["#14213d", "#0e7490", "#1f6b4a", "#c2410c"],
      ["Tennis courts in the morning", "Open play warm-up", "The Tuesday ladder", "Club championships"],
    ),
    news: [
      {
        title: "Ladder season 4 sign-ups are open",
        body: "Six weeks, one division, one champion. Sign up at the front desk or send the club a message.",
        daysAgo: 4,
      },
    ],
    eventSlugs: ["manila-mixed-classic"],
  },
  {
    slug: "mad-shock-pickleball",
    name: "Mad Shock Pickleball",
    about:
      "Mad Shock is a competition-first club in General Trias. Home of the Harbor Spring Open, with six courts, a weekly king-of-the-court night, and a pro shop on site.",
    address: "8001, Arnaldo Hwy, Brgy. Pasong Camachile II, General Trias Cavite",
    city: "General Trias",
    country: "Philippines",
    phone: "09180001111",
    email: "play@madshock.ph",
    logoColor: "#b91c1c",
    coverColor: "#1c1917",
    memberCount: 477,
    lat: 14.3869,
    lng: 120.8813,
    courts: courts(6, "₱400/hr", true),
    openPlay: socialOpenPlay("Mad Shock"),
    photos: gallery(
      ["#1c1917", "#b91c1c", "#c2410c", "#174f37"],
      ["King of the court, Friday night", "The pro shop wall", "Center court before finals", "Junior squad"],
    ),
    news: [
      {
        title: "Harbor Spring Open brackets are live",
        body: "Pool play starts at 9am. Check the event page for courts, times and live scores.",
        daysAgo: 1,
      },
      {
        title: "Friday king-of-the-court moves to 7pm",
        body: "One hour later for the summer. Same format: winners stay, challengers rotate.",
        daysAgo: 12,
      },
    ],
    eventSlugs: ["harbor-spring-open"],
  },
  {
    slug: "northside-pickleball",
    name: "Northside Pickleball",
    about:
      "A friendly north-side club built around open play. Northside is opening its permanent courts soon — follow the hub for the launch schedule and founding-member rates.",
    address: "RX5W+5C Santa Maria, Bulacan, Philippines",
    city: "Santa Maria",
    country: "Bulacan, Philippines",
    phone: "09190002222",
    email: "hello@northsidepickle.ph",
    logoColor: "#1f6b4a",
    coverColor: "#365314",
    memberCount: 1,
    lat: 14.7942,
    lng: 120.8794,
    comingSoon: true,
    courts: courts(3, "₱250/hr"),
    openPlay: [
      {
        weekday: 6,
        title: "Northside Founding Social",
        startTime: "08:00",
        endTime: "11:00",
        court: "Courts 1–3",
        level: "All levels",
        capacity: 24,
        price: "Free",
      },
    ],
    photos: gallery(
      ["#365314", "#1f6b4a", "#c2410c"],
      ["The courts taking shape", "Founding-member preview day", "Northside at sunset"],
    ),
    news: [
      {
        title: "We are almost open",
        body: "Three courts, lights, and a small clubhouse. Follow the hub to get the opening-day invite.",
        daysAgo: 3,
      },
    ],
    eventSlugs: ["seoul-spring-invitational"],
  },
  {
    slug: "pickle-era",
    name: "Pickle Era",
    about:
      "Pickle Era is a community-first club in Imus with a packed social calendar. Four courts, coaching for every level, and a Sunday rally that fills up fast.",
    address: "Plaridel 5, Tanzang Luma 5, Imus Cavite",
    city: "Imus",
    country: "Philippines",
    phone: "09190003333",
    email: "team@pickleera.ph",
    logoColor: "#7c3aed",
    coverColor: "#3b0764",
    memberCount: 214,
    lat: 14.4297,
    lng: 120.9367,
    comingSoon: true,
    courts: courts(4, "₱300/hr"),
    openPlay: socialOpenPlay("Pickle Era"),
    photos: gallery(
      ["#3b0764", "#7c3aed", "#c2410c", "#174f37"],
      ["Sunday Rally warm-up", "The coaching wall", "Court-side coffee", "Era league night"],
    ),
    news: [
      {
        title: "Court resurfacing this week",
        body: "Courts 1 and 2 are closed until Friday. All open play moves to Courts 3 and 4.",
        daysAgo: 5,
      },
    ],
    eventSlugs: ["singapore-mixed-league-s3"],
  },
  {
    slug: "picklebos-sports-center",
    name: "Picklebos Sports Center",
    about:
      "A multi-sport center in Masbate City with pickleball, badminton and futsal under one roof. Picklebos hosts the island's biggest indoor open play and a monthly ladder.",
    address: "Masbate City, Masbate",
    city: "Masbate City",
    country: "Philippines",
    phone: "09190004444",
    email: "frontdesk@picklebos.ph",
    logoColor: "#a16207",
    coverColor: "#422006",
    memberCount: 89,
    lat: 12.3703,
    lng: 123.6249,
    comingSoon: true,
    courts: courts(5, "₱350/hr", true),
    openPlay: socialOpenPlay("Picklebos"),
    photos: gallery(
      ["#422006", "#a16207", "#c2410c"],
      ["The indoor hall", "Open play queue", "Island ladder finals"],
    ),
    news: [
      {
        title: "Indoor season opens next month",
        body: "Five air-conditioned courts, one membership. The booking grid opens on the first of the month.",
        daysAgo: 7,
      },
    ],
    eventSlugs: ["hong-kong-winter-cup"],
  },
  {
    slug: "manila-pickle-yard",
    name: "Manila Pickle Yard",
    about:
      "An urban pickleball yard in the middle of Manila. Compact, loud, and booked solid every night — four courts, a wall for solo drills, and a rotating food truck.",
    address: "918 Arnaiz Ave, Makati, Metro Manila",
    city: "Makati",
    country: "Philippines",
    phone: "09190005555",
    email: "court@manilapickleyard.ph",
    logoColor: "#14213d",
    coverColor: "#1f6b4a",
    memberCount: 342,
    lat: 14.5547,
    lng: 121.0244,
    courts: courts(4, "₱450/hr"),
    openPlay: [
      {
        weekday: 1,
        title: "Monday Night Lights",
        startTime: "19:00",
        endTime: "22:00",
        court: "Courts 1–4",
        level: "Intermediate",
        capacity: 32,
        price: "₱350",
      },
      {
        weekday: 3,
        title: "Wednesday Lunch Rally",
        startTime: "11:30",
        endTime: "13:30",
        court: "Courts 1–2",
        level: "All levels",
        capacity: 16,
        price: "₱250",
      },
      {
        weekday: 5,
        title: "Friday Night Open",
        startTime: "18:00",
        endTime: "22:00",
        court: "Courts 1–4",
        level: "All levels",
        capacity: 40,
        price: "₱350",
      },
    ],
    photos: gallery(
      ["#1f6b4a", "#14213d", "#c2410c", "#0e7490"],
      ["Night lights on Arnaiz", "The drill wall", "Friday food truck", "Makati league"],
    ),
    news: [
      {
        title: "Friday Night Open adds a fourth court",
        body: "More spots, same price. The 6pm block now runs across all four courts.",
        daysAgo: 2,
      },
    ],
    eventSlugs: ["manila-mixed-classic"],
  },
];
