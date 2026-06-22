/**
 * Netlify Function: /api/neighbour-events
 *
 * Pulls the official British Orienteering open-data fixtures JSON feed,
 * filters for the 5 KERNO-neighbouring clubs (EPOC / SROC / AIRE / SELOC /
 * MDOC), and returns a small structured list for the events page to
 * render into a table.
 *
 * Endpoint: https://www.britishorienteering.org.uk/fullfixturesjson.php
 * Conforms to OpenActive Realtime Paged Data Exchange 0.2.3.
 *
 * The response is cached at the Netlify edge for 1 hour, so even on a
 * busy day BOF only gets a handful of hits per hour. Stale cache is
 * served for up to a day while a fresh copy is fetched in the
 * background.
 *
 * Returns JSON: { events: NeighbourEvent[], fetchedAt: string,
 *                 perClub: { abbr, count }[],
 *                 totalFromFeed: number,
 *                 status: string }
 */

// Each neighbouring club has both an abbreviation and a numeric BOF
// club ID. The fixturesjson.php feed sometimes returns the abbreviation
// in the `club` field, sometimes a numeric id, sometimes the full club
// name. We accept any of the three so we don't depend on BOF's choice.
const CLUBS = [];

const TARGET_ABBRS = new Set(CLUBS.map(c => c.abbr));
const TARGET_IDS   = new Set(CLUBS.map(c => c.bofClubId));
const TARGET_NAMES = new Set(CLUBS.map(c => c.fullName.toLowerCase()));

/** Resolve any of (abbr | numeric id | full name) → canonical abbr. */
function resolveClub(raw) {
  if (raw == null) return null;
  // Numeric id
  if (typeof raw === 'number') {
    const m = CLUBS.find(c => c.bofClubId === raw);
    return m ? m.abbr : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // Numeric string
  if (/^\d+$/.test(s)) {
    const m = CLUBS.find(c => c.bofClubId === Number(s));
    return m ? m.abbr : null;
  }
  // Uppercase abbr match
  const upper = s.toUpperCase();
  if (TARGET_ABBRS.has(upper)) return upper;
  // Full name match (case-insensitive substring)
  const lower = s.toLowerCase();
  for (const c of CLUBS) {
    if (lower.includes(c.fullName.toLowerCase())) return c.abbr;
  }
  return null;
}

/**
 * Per-association feeds. Our 5 clubs span two BOF associations:
 *   NWOA  - North-West Orienteering Association (SROC, SELOC, MDOC)
 *   YHOA  - Yorkshire & Humberside Orienteering Association (AIRE, EPOC)
 * The per-association feed is much smaller than the full national one
 * and tends to return only recent + future fixtures.
 */
const FEED_URLS = [
  'https://www.britishorienteering.org.uk/fixturesjson.php?assoc=NWOA',
  'https://www.britishorienteering.org.uk/fixturesjson.php?assoc=YHOA',
];

async function fetchOneFeed(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KERNO-website/1.0; +https://cornwallorienteering.org.uk)',
      'Accept': 'application/json,application/ld+json,*/*',
    },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  });
  if (!res.ok) {
    console.log(`[neighbour-events] ${url} → HTTP ${res.status}`);
    return [];
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.log(`[neighbour-events] ${url} → bad JSON (${text.length} bytes)`);
    return [];
  }
  // Possible response shapes: array | {items: [...]} | {fixtures: [...]}
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items.map(i => i.data || i).filter(Boolean);
  if (Array.isArray(data?.fixtures)) return data.fixtures;
  return [];
}

async function fetchFeed() {
  const results = await Promise.all(FEED_URLS.map(fetchOneFeed));
  return results.flat();
}

/**
 * Map one BOF event record → our NeighbourEvent shape.
 *
 * The fixturesjson.php?assoc=XXX endpoint returns flat objects of this shape:
 *   date                       - "2026-05-06"
 *   title                      - event name
 *   link                       - BOF event detail URL
 *   venue                      - short venue name
 *   nearest_town               - town
 *   grid_ref, postcode         - location identifiers
 *   club                       - club abbreviation, e.g. "AIRE"
 *   association                - region abbr, e.g. "NWOA"
 *   level                      - "Local" / "Regional" / "National" / "Major"
 *   number                     - BOF event id, e.g. 87374
 *   event_specific_website     - club's own event page
 *   final_details_web_page     - final details URL
 *
 * (Distinct from the older `fullfixturesjson.php` shape which uses
 * date_start, name, session_url, nested location/details - kept as
 * fallback field names below in case BOF changes or returns either
 * shape on different endpoints.)
 */
function normalize(e) {
  const club = resolveClub(e.club);
  if (!club) return null;

  const dateRaw = e.date || e.date_start || e.start_date;
  if (!dateRaw) return null;
  const date = new Date(dateRaw);
  if (isNaN(date.getTime())) return null;

  // Today onwards only - keep events from up to 1 day ago so a same-day
  // event still shows in the morning.
  if (date.getTime() < Date.now() - 86_400_000) return null;

  const title = (e.title || e.name || '').toString().trim();
  if (!title) return null;

  // Prefer BOF's own event page link (matches what the old KERNO site does).
  // Fall back to club page or details page if BOF link is missing.
  const url =
    e.link ||
    e.session_url ||
    e.event_specific_website ||
    e.final_details_web_page ||
    'https://www.britishorienteering.org.uk/event';

  // "Near" - town first (nearest_town), then venue.
  // Per-association feed has these at top level; full feed nests them.
  const loc = e.location || {};
  const near = [
    e.nearest_town,
    e.venue,
    loc.nearest_town,
    loc.venue,
    loc.event_centre,
  ]
    .filter(Boolean)
    .map(s => s.toString().trim())
    .find(Boolean);

  const level = (e.level || '').toString().trim() || undefined;

  return {
    date: date.toISOString(),
    title,
    club,
    near: near?.slice(0, 80),
    level: level?.slice(0, 40),
    url,
  };
}

export default async (req) => {
  const fetchedAt = new Date().toISOString();
  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';

  let totalFromFeed = 0;
  let events = [];
  let status = 'ok';
  let rawSample = null;
  let distinctClubs = null;

  try {
    const raw = await fetchFeed();
    totalFromFeed = raw.length;

    if (debug) {
      // Capture a small unfiltered sample + a tally of every distinct
      // value that appeared in the various club-identifier fields, so
      // we can see exactly what BOF is returning.
      rawSample = raw.slice(0, 3);
      const tally = {};
      for (const e of raw) {
        const v = e.club ?? e.club_id ?? e.clubId ?? e.organiser ?? e.host ?? '(none)';
        const key = typeof v === 'object' ? JSON.stringify(v) : String(v);
        tally[key] = (tally[key] || 0) + 1;
      }
      distinctClubs = Object.entries(tally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([value, count]) => ({ value, count }));
    }

    events = raw.map(normalize).filter(Boolean);
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    events = events.slice(0, 30);
  } catch (err) {
    status = `error: ${err.message}`;
    console.log('[neighbour-events]', status);
  }

  const perClub = CLUBS.map(c => ({
    abbr: c.abbr,
    count: events.filter(e => e.club === c.abbr).length,
  }));

  console.log(
    `[neighbour-events] ${status} - feed=${totalFromFeed} kept=${events.length} ` +
    perClub.map(p => `${p.abbr}=${p.count}`).join(' '),
  );

  const body = { events, fetchedAt, perClub, totalFromFeed, status };
  if (debug) {
    body.rawSample = rawSample;
    body.distinctClubs = distinctClubs;
  }

  return new Response(JSON.stringify(body), {
    status: 200, // always 200 - page falls back gracefully
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Edge cache 1 hour, accept stale up to 1 day while revalidating.
      // Debug responses bypass cache so we always see fresh data while iterating.
      'Cache-Control': debug
        ? 'no-store'
        : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
