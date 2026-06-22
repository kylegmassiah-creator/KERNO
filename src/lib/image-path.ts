/**
 * Normalise an image path saved by Decap CMS into a browser-usable URL.
 *
 * Decap occasionally writes image-widget paths inconsistently:
 *   1. With the *disk* prefix:  `public/assets/uploads/foo.jpg`
 *   2. With the URL prefix:     `/assets/uploads/foo.jpg`  ✓ canonical
 *   3. As a bare filename:      `foo.jpg`
 *
 * (3) was happening on Andy's hero-photo CMS saves - the picker stored
 * just the filename, so the browser tried to fetch `/foo.jpg` from the
 * site root and got a 404 even though the file existed at
 * `/assets/uploads/foo.jpg`. This helper handles all three cases so the
 * underlying CMS quirk can't silently break a page hero again.
 *
 * Leaves absolute http/https URLs and data: URIs alone.
 */
export function normaliseImagePath(
  p?: string | null,
  /** Optional fallback folder for the bare-filename case. When set, a bare
   *  filename like `foo.jpg` is rewritten to `<fallbackFolder>/foo.jpg`
   *  instead of the default `/assets/uploads/foo.jpg`. Used by the events
   *  template so bare-filename hero saves resolve to the event's own
   *  media folder (`/results-archive/{year}/{slug}/`). */
  fallbackFolder?: string,
): string | undefined {
  if (!p) return undefined;
  const trimmed = p.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('data:')) return trimmed;
  // Case 1: strip the "public/" disk prefix and make absolute
  let out = trimmed.replace(/^public\//, '/');
  // Case 3: bare filename → assume the supplied fallback folder, or the
  // standard CMS uploads folder if none was provided.
  // (only treat as a bare filename if it has no slashes at all AND
  // looks like an image - file extension present)
  if (!out.startsWith('/') && !out.includes('/') && /\.[a-z0-9]+$/i.test(out)) {
    const folder = (fallbackFolder ?? '/assets/uploads').replace(/\/$/, '');
    out = `${folder}/${out}`;
  }
  // Case 2 (already canonical) + safety: make sure result starts with /
  if (!out.startsWith('/')) out = '/' + out;
  return out;
}
