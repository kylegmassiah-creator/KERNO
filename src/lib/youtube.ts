/**
 * Parse any flavour of YouTube reference into the 11-character video ID.
 *
 * Accepts:
 *   - https://youtu.be/XXXXXXXXXXX            (short share URL - the default
 *                                              format Andy will paste from
 *                                              YouTube's mobile share sheet)
 *   - https://youtu.be/XXXXXXXXXXX?si=...     (with tracking params)
 *   - https://www.youtube.com/watch?v=XXXXXXXXXXX
 *   - https://www.youtube.com/watch?v=XXXXXXXXXXX&list=...
 *   - https://www.youtube.com/embed/XXXXXXXXXXX
 *   - https://www.youtube.com/shorts/XXXXXXXXXXX
 *   - XXXXXXXXXXX                              (raw 11-char ID)
 *
 * Returns the ID, or null if the input doesn't look like a valid YouTube
 * reference. Callers should treat null as "don't render an embed".
 */
export function parseYouTubeId(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Raw 11-char ID - YouTube IDs are URL-safe base64 (A–Z, a–z, 0–9, -, _).
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // Try parsing as URL.
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      // https://youtu.be/<id>
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      // /watch?v=<id>
      const v = url.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

      // /embed/<id> or /shorts/<id> or /live/<id>
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // Not a URL - fall through to null.
  }
  return null;
}

/**
 * Build the privacy-enhanced YouTube embed URL for a parsed ID.
 * youtube-nocookie.com doesn't drop tracking cookies until the viewer
 * actually plays the video, which is the friendlier default for a
 * non-commercial club site.
 */
export function youTubeEmbedSrc(id: string, opts: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
  if (opts.autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

/**
 * Build the standard YouTube thumbnail URL. `hqdefault` is the most
 * reliably-present 480×360 thumbnail (`maxresdefault` is missing for
 * some older uploads, so we don't risk it).
 */
export function youTubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}
