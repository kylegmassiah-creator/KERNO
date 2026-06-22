/**
 * Build-time fetcher for neighbouring-club events.
 *
 * Strategy: hit British Orienteering's event search once per club using the
 * pre-filtered URL (?evt_assoc=14&evt_club=<id>) - that returns just that
 * club's upcoming events, so we don't need to identify the club from row
 * text. Each request runs in parallel; one club failing doesn't drop the
 * others. If everything fails, the page falls back to a club-card list.
 *
 * Logs a one-line per-club summary to the build log so we can see at a
 * glance how many events each club returned.
 */

import { neighbouringClubs, type NeighbourClub } from '../data/neighbouring-clubs';

export interface NeighbourEvent {
  date: Date;
  title: string;
  club: string;     // EPOC / SROC / AIRE / SELOC / MDOC
  near?: string;    // venue / location
  level?: string;   // Local / Regional / National etc.
  url: string;      // link to BOF event detail
}

/* ─────────── Helpers ─────────── */

function parseLooseDate(raw: string): Date | null {
  if (!raw) return null;
  const t = raw.trim();

  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);

  // DD/MM/YYYY or DD-MM-YYYY (or DD/MM/YY)
  const dmy = t.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return new Date(`${yr}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T00:00:00Z`);
  }

  // "17 May 2026" / "Sat 17 May 2026" / "17th May 2026"
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const txt = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (txt) {
    const m = months[txt[2].slice(0, 3).toLowerCase()];
    if (m) return new Date(`${txt[3]}-${m}-${txt[1].padStart(2, '0')}T00:00:00Z`);
  }
  return null;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

const BOF_BASE = 'https://www.britishorienteering.org.uk';

function buildBofUrl(bofClubId: number): string {
  // Mirrors the working URLs Andy provided: no association filter, no
  // postcode (so radius is moot - we just get every event for that club),
  // bFilter=1 to actually run the filter on BOF's side.
  const params = new URLSearchParams({
    pg: '',
    evt_name: '',
    evt_postcode: '',
    radius: '150',
    evt_assoc: '',
    evt_club: String(bofClubId),
    evt_competitions: '0',
    filter_type: 'Select...',
    filter_start: '',
    filter_end: '',
    entry_closing: '0',
    cancelled_events: '0',
    bFilter: '1',
  });
  return `${BOF_BASE}/event?${params.toString()}`;
}

/* ─────────── Parse one club's BOF results page ───────────
 *
 * BOF's filtered event search returns an HTML table where each row
 * represents one event. We grab every <tr> in the body, skip header
 * rows, and try to pull out: date, title (linked), location/level.
 * The exact column order varies, so we use heuristics - the linked
 * cell is the title; the cell that parses as a date is the date;
 * remaining cells are joined for "near" + "level".
 */
function parseBofClubHtml(html: string, club: NeighbourClub): NeighbourEvent[] {
  const out: NeighbourEvent[] = [];

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    // Skip header rows
    if (/<th[\s>]/i.test(row)) continue;

    const cells: string[] = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(row))) cells.push(c[1]);
    if (cells.length < 2) continue;

    // Find the cell that parses as a date
    let date: Date | null = null;
    let dateIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      const d = parseLooseDate(stripTags(cells[i]));
      if (d) { date = d; dateIdx = i; break; }
    }
    if (!date) continue;

    // Find the first <a href> in the row - that's the event title link
    const linkM = row.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    // Decode entity-encoded slashes etc. in the href before further work,
    // otherwise URLs like "&#x2f;&#x2f;www.britishorienteering.org.uk&#x2f;…"
    // get mangled. BO's table HTML sometimes ships entity-encoded URLs.
    let url = decodeEntities(linkM[1]);
    if (!/^https?:\/\//i.test(url)) {
      url = url.startsWith('/') ? `${BOF_BASE}${url}` : `${BOF_BASE}/${url}`;
    }
    const title = decodeEntities(stripTags(linkM[2])).trim();
    if (!title) continue;

    // Remaining cells (excluding date + the cell that contained the link)
    // get used for "near" and "level" in best-guess order.
    const titleCellIdx = cells.findIndex(c => /<a[^>]+href=/i.test(c));
    const remainder = cells
      .map((cell, i) => ({ cell, i }))
      .filter(({ i }) => i !== dateIdx && i !== titleCellIdx)
      .map(({ cell }) => decodeEntities(stripTags(cell)).trim())
      .filter(Boolean);

    // Heuristic: short uppercase-ish strings ("Local", "Regional",
    // "Level C", "URBAN") are level; longer free text is location.
    let level: string | undefined;
    let near: string | undefined;
    for (const text of remainder) {
      if (!level && /^(local|regional|national|major|level\s*[a-d]|urban|night|score|sprint)/i.test(text) && text.length <= 30) {
        level = text;
      } else if (!near) {
        near = text;
      }
    }

    out.push({
      date,
      title,
      club: club.abbr,
      near: near?.slice(0, 80),
      level: level?.slice(0, 40),
      url,
    });
  }

  return out;
}

/* ─────────── Public: fetch all clubs in parallel ─────────── */

async function fetchOneClub(club: NeighbourClub): Promise<NeighbourEvent[]> {
  const url = buildBofUrl(club.bofClubId);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'KERNO-website-build/1.0 (https://cornwallorienteering.org.uk)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
    });
    if (!res.ok) {
      console.log(`[neighbour-events] ${club.abbr}: HTTP ${res.status}`);
      return [];
    }
    const html = await res.text();
    const events = parseBofClubHtml(html, club);
    console.log(`[neighbour-events] ${club.abbr}: ${events.length} events parsed (html ${html.length} bytes)`);
    return events;
  } catch (err) {
    console.log(`[neighbour-events] ${club.abbr}: fetch error - ${(err as Error).message}`);
    return [];
  }
}

export async function fetchNeighbourEvents(): Promise<NeighbourEvent[]> {
  const all = (await Promise.all(neighbouringClubs.map(fetchOneClub))).flat();

  const now = Date.now() - 86_400_000; // include today
  const seen = new Set<string>();
  const out = all
    .filter(e => e.date.getTime() >= now)
    .filter(e => {
      const key = `${e.date.toISOString().slice(0, 10)}|${e.title}|${e.club}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 30);

  console.log(`[neighbour-events] total: ${out.length} events across ${neighbouringClubs.length} clubs`);
  return out;
}
