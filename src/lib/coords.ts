/**
 * Resolve an event's coordinates by preferring the CMS map-pin output
 * (Decap "map" widget - a GeoJSON Point string) over the manual
 * lat/lng object. Returns undefined when neither is present.
 *
 * Used so committee members can drop a pin on the map and have all
 * downstream features (event detail Leaflet map, four external map
 * links, events list map) light up automatically.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

function parsePaste(s: string): LatLng | undefined {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return undefined;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined;
  return { lat, lng };
}

function parseGeoJson(s: string): LatLng | undefined {
  try {
    const obj = JSON.parse(s);
    if (
      obj &&
      obj.type === 'Point' &&
      Array.isArray(obj.coordinates) &&
      obj.coordinates.length >= 2
    ) {
      const [lng, lat] = obj.coordinates as [number, number];
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

export function resolveCoords(event: {
  coordsMethod?: 'pin' | 'paste' | 'google';
  coordsGeoJson?: string;
  coordsPaste?: string;
  coordsGoogle?: string;
  coords?: LatLng;
}): LatLng | undefined {
  // When the editor has explicitly chosen a method, honour it strictly.
  // This makes the coordinate input deterministic - the same event can
  // never have two conflicting locations on different parts of the site.
  if (event.coordsMethod === 'paste') {
    return event.coordsPaste ? parsePaste(event.coordsPaste) : undefined;
  }
  if (event.coordsMethod === 'pin') {
    return event.coordsGeoJson ? parseGeoJson(event.coordsGeoJson) : undefined;
  }
  if (event.coordsMethod === 'google') {
    return event.coordsGoogle ? parsePaste(event.coordsGoogle) : undefined;
  }

  // Backward-compat fallback for events created before coordsMethod
  // existed. Prefer google > paste > map pin > legacy manual lat/lng.
  if (event.coordsGoogle) {
    const c = parsePaste(event.coordsGoogle);
    if (c) return c;
  }
  if (event.coordsPaste) {
    const c = parsePaste(event.coordsPaste);
    if (c) return c;
  }
  if (event.coordsGeoJson) {
    const c = parseGeoJson(event.coordsGeoJson);
    if (c) return c;
  }
  return event.coords;
}
