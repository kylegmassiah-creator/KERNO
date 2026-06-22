/**
 * Neighbouring clubs whose events KERNO members may also want to enter.
 *
 * `bofClubId` is the club's ID inside British Orienteering's event search
 * (the `evt_club=` URL parameter), used by the build-time fetcher.
 *
 * Cornwall sits in the South West Orienteering Association (SWOA). Add the
 * neighbouring SW clubs you want to surface (e.g. Devon Orienteering, with
 * their British Orienteering club ID) and they'll appear on the Fixtures
 * page. Left empty for now so no other club's events show until the
 * committee chooses which to include.
 */

export interface NeighbourClub {
  abbr: string;
  name: string;
  region: string;
  eventsUrl: string;   // public-facing club events page (fallback link)
  bofClubId: number;   // ID inside britishorienteering.org.uk event search
}

export const neighbouringClubs: NeighbourClub[] = [];
