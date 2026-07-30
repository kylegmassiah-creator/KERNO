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

export const neighbouringClubs: NeighbourClub[] = [
  { abbr: 'DEVON', name: 'Devon Orienteering', region: 'South West (SWOA)', eventsUrl: 'https://www.devonorienteering.co.uk/events', bofClubId: 0 },
  { abbr: 'WIM', name: 'Wimborne Orienteers', region: 'South West (SWOA)', eventsUrl: 'https://www.wimborne-orienteers.co.uk/', bofClubId: 0 },
  { abbr: 'WSX', name: 'Wessex Orienteers', region: 'South West (SWOA)', eventsUrl: 'https://www.wessex-oc.org/', bofClubId: 0 },
  { abbr: 'QO', name: 'Quantock Orienteers', region: 'South West (SWOA)', eventsUrl: 'https://www.quantockorienteers.co.uk/', bofClubId: 0 },
  { abbr: 'BOK', name: 'Bristol Orienteering Klub', region: 'South West (SWOA)', eventsUrl: 'https://www.bristolorienteering.org.uk/', bofClubId: 0 },
  { abbr: 'NGOC', name: 'North Gloucestershire Orienteering Club', region: 'South West (SWOA)', eventsUrl: 'https://www.ngoc.org.uk/', bofClubId: 0 },
  { abbr: 'NWO', name: 'North Wilts Orienteers', region: 'South West (SWOA)', eventsUrl: 'https://www.northwilts.org.uk/', bofClubId: 0 },
  { abbr: 'SARUM', name: 'Sarum Orienteers', region: 'South West (SWOA)', eventsUrl: 'https://www.sarumo.co.uk/', bofClubId: 0 },
];
