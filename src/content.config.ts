// Astro Content Collections - schema definitions
//
// Every event, news article, map, etc. is a Markdown file in src/content/<collection>/
// with frontmatter that matches the schema below. The CMS (Phase 7) will edit these
// files directly. The site reads from the collections to render every page.

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/cornwall-content/events' }),
  schema: z.object({
    // ─────── Identification
    title: z.string(),

    // ─────── When
    // `date` is when the event happens
    // `entryCloseDate` is when online entries close - this is what drives the
    // automatic transition from "upcoming events" to "past results" on the site.
    date: z.date(),
    startTime: z.string().optional(),       // display string, e.g. "7:00pm"
    entryCloseDate: z.date(),

    // ─────── Where
    location: z.string(),                   // short label for cards, e.g. "Truro"
    venue: z.string().optional(),           // specific building, e.g. "Ighten Leigh Social Club"
    postcode: z.string().optional(),
    coords: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
    /** Which coordinate input method the editor chose for this event.
     *  "pin"    → reads coordsGeoJson (Decap built-in Leaflet picker)
     *  "paste"  → reads coordsPaste   (manual Google Maps lat,lng paste)
     *  "google" → reads coordsGoogle  (custom Decap Google Maps widget)
     *  Forces a deliberate single source of truth so the same event
     *  can't accidentally have two conflicting pins. */
    coordsMethod: z.enum(['pin', 'paste', 'google']).optional(),
    /** Optional Decap CMS "map widget" output - a GeoJSON Point string
     *  like `{"type":"Point","coordinates":[-2.21,53.85]}`. Only used
     *  when coordsMethod is "pin" (or unset, for backward compat). */
    coordsGeoJson: z.string().optional(),
    /** Convenience field for Google-Maps-style "lat, lng" paste -
     *  right-click → click coords → paste here. Only used when
     *  coordsMethod is "paste" (the default for new events). */
    coordsPaste: z.string().optional(),
    /** Output of the custom Decap Google Maps pin-picker - same
     *  "lat,lng" shape as coordsPaste, but written by the widget on
     *  drag/click rather than a human paste. Only used when
     *  coordsMethod is "google". */
    coordsGoogle: z.string().optional(),
    what3words: z.string().optional(),      // e.g. "typically.capacity.skips" - common on UK
                                            // orienteering events for the event-centre/parking
    gridRef: z.string().optional(),         // OS grid ref, e.g. "SD848335"

    // ─────── What
    format: z.string(),                     // "Urban Score", "Street-O", "Snook-O", "Standard"
    level: z.enum(['local', 'regional', 'national', 'major']),
    duration: z.number().optional(),        // minutes
    series: z.string().optional(),          // e.g. "May Street-O", "June Series 2/3"
    // British Orienteering event ID, e.g. 87374. String OR number - the
    // editor may enter "TBC" while the event is being registered with BO
    // and a number hasn't been assigned yet. Old events with numeric
    // YAML values still parse cleanly. Stays optional in the schema so
    // legacy events without it don't fail the build; the CMS marks it
    // required for new entries.
    bofEventNumber: z.union([z.string(), z.number()]).optional(),
    dogsAllowed: z.enum([
      'yes',                                // explicitly welcomed
      'on-lead',                            // permitted on lead only
      'no',                                 // not permitted
      'not-recommended',                    // discouraged (e.g. urban / Street-O)
    ]).optional(),
    dogNotes: z.string().optional(),        // free-text expansion shown next to the
                                            // dropdown answer, e.g. "not recommended on urban
                                            // courses due to traffic hazard"

    // ─────── Officials
    // These four cover every named role across KERNO events:
    //   planner          - designs the courses
    //   controller       - independent oversight on regional+ events
    //   organiser        - runs the event on the day (registration etc.)
    //   seriesOrganiser  - multi-event series coordinator
    // The previous free-text `contactsOfficials` section duplicated these
    // and is gone - committee members now fill each role into its own field
    // once, and the page renders them consistently.
    planner: z.string().optional(),         // e.g. "Richard Edwards (KERNO)"
    controller: z.string().optional(),      // present on regional+ events
    organiser: z.string().optional(),       // e.g. "Hannah Dabinett (KERNO)"
    seriesOrganiser: z.string().optional(), // e.g. "Kay Hawke (KERNO)"

    // ─────── How much
    entryFee: z.string().optional(),        // free-text, e.g. "From £6" or "£6 / £8 pair"
    capacity: z.number().optional(),

    // ─────── External links
    // Plain string rather than .url() so the CMS can save empty values
    // when the field isn't filled in. Validation happens at render time.
    siEntriesUrl: z.string().optional(),
    routeGadgetUrl: z.string().optional(),

    // ─────── Display
    summary: z.string(),                    // 1-line subtitle for cards
    description: z.string().optional(),     // 1–2 sentences for the homepage hero, if featured
    /** Optional hero photo shown across the top of the event detail page.
     *  Leave blank for the default text-only event hero. */
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    /** How the hero image should fit the banner. Default is `cover` (fills
     *  the full banner, crops anything that doesn't fit - best for
     *  landscape photos). Use `contain` for non-photographic heroes like
     *  logos so the whole image stays visible with navy letterbox bars
     *  filling any extra space. */
    heroFit: z.enum(['cover', 'contain']).optional(),

    // ─────── Pre-event briefing
    // Free-form markdown shown in a blue info panel above the body
    // content. Used for the "what to expect on the day" briefing that
    // the old KERNO site placed prominently above the location block -
    // event format intro, kit expectations, safety procedures, etc.
    // Optional; if blank the panel doesn't render.
    preEventInfo: z.string().optional(),

    // ─────── Sections that auto-hide once the event is past
    // Six standard event sections lifted out of the long-form body so
    // the public event page can hide the "how to enter / what to bring"
    // chunks the moment the entry-close date passes - but committee
    // members keep them in the CMS for reference when they plan the
    // next year's edition. Each has a paired `*KeepAfter` boolean that
    // forces the section to stay visible after the event (rarely used,
    // but available for one-off cases). Map and terrain / Course
    // information stay in the long-form body - they describe the area
    // and the format and remain useful to a public visitor browsing
    // past events.
    registrationDetails: z.string().optional(),
    registrationDetailsKeepAfter: z.boolean().optional(),
    directionsAndParking: z.string().optional(),
    directionsAndParkingKeepAfter: z.boolean().optional(),
    entryDetails: z.string().optional(),
    entryDetailsKeepAfter: z.boolean().optional(),
    facilities: z.string().optional(),
    facilitiesKeepAfter: z.boolean().optional(),
    // `dogRestrictions` and `contactsOfficials` were removed in the schema
    // cleanup. Dog info now lives in the dogsAllowed enum + dogNotes free-text
    // field. Officials live in the structured planner/controller/organiser/
    // seriesOrganiser fields above. One source of truth per piece of info.

    // ─────── Per-event disclaimer
    // The yellow box on the event page. By default every event shows
    // the club-wide BO public-liability notice (see DEFAULT_DISCLAIMER
    // in pages/events/[slug].astro). To replace it with bespoke wording
    // for this event, tick `disclaimerOverride` AND fill in `disclaimer`
    // with the markdown text to display instead. With override off, the
    // `disclaimer` field is ignored.
    disclaimerOverride: z.boolean().optional(),
    disclaimer: z.string().optional(),

    // ─────── Post-event report (filled in after the event)
    // Free-form markdown - typically organiser comments, planner comments,
    // lost property, photo credits etc. When set, a "Report" button appears
    // next to the results files on the event detail page, linking to a
    // dedicated /events/{slug}/report page that renders this content.
    report: z.string().optional(),

    // ─────── Results (filled in after the event)
    results: z.array(z.object({
      label: z.string(),                    // "Full results", "Splits", "RouteGadget"
      url: z.string(),                      // plain string for CMS-friendliness
      type: z.enum(['html', 'pdf', 'xlsx', 'csv']),
      /** Hide this individual results file from the public event page
       *  without deleting the entry. Useful for results withdrawn for
       *  correction. */
      hidden: z.boolean().optional(),
    })).optional(),

    // ─────── Pre-event attachments
    // Course details, briefing notes, parking maps, entry forms - anything
    // visitors should be able to download from the event page. Rendered as
    // a download list at the bottom of the event body.
    attachments: z.array(z.object({
      label: z.string(),
      file: z.string(),
      type: z.enum(['pdf', 'docx', 'xlsx', 'csv', 'image', 'other']).optional(),
    })).optional(),

    // ─────── Photo gallery (filled in after the event)
    // Optional set of post-event photos with alt text and an optional
    // caption. Rendered below the body as a responsive grid. Same shape
    // as the news-article gallery for consistency.
    gallery: z.array(z.object({
      src: z.string(),
      alt: z.string().optional(),
      caption: z.string().optional(),
    })).optional(),

    // ─────── Misc
    cancelled: z.boolean().optional(),
    /** Hide this event from every public page without deleting it.
     *  Use this for test entries, future events not ready for public
     *  view, or anything you'd otherwise be tempted to hard-delete.
     *  Hidden events stay in the CMS and can be un-hidden any time. */
    hidden: z.boolean().optional(),
    notes: z.string().optional(),           // committee-only notes, not rendered to public
  }),
});

// ─────── News collection
// Each .md file is one news article. Frontmatter holds the publication date,
// summary, and optional hero image. The Markdown body is the long-form article.
const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/cornwall-content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    summary: z.string(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    author: z.string().optional(),
    gallery: z.array(z.object({
      src: z.string(),
      alt: z.string().optional(),
      caption: z.string().optional(),
    })).optional(),
    attachments: z.array(z.object({
      label: z.string(),
      file: z.string(),
      type: z.enum(['pdf', 'docx', 'xlsx', 'csv', 'image', 'other']).optional(),
    })).optional(),
    draft: z.boolean().optional(),
    /** Pin this article to the top of the news list and use it as the
     *  featured article on the homepage, overriding the default
     *  "most recent" behaviour. Use it to surface an older article that
     *  has become relevant again. */
    featured: z.boolean().optional(),
    /** Optional manual sort order. Lower numbers sort earlier (closer
     *  to the top of the news list). Use to override the default
     *  newest-first behaviour and push a specific article into a
     *  specific slot. Leave blank for the normal date-based order.
     *  Featured articles still pin above ordered + dated ones. */
    order: z.number().optional(),
  }),
});

// ─────── Maps collection
// Each .md file is one mapped area. Frontmatter holds the area name, terrain
// type, image (the orienteering map itself), and metadata. Markdown body is
// the long-form description, history of the area, access notes, etc.
const maps = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/cornwall-content/maps' }),
  schema: z.object({
    title: z.string(),                       // "Hurstwood", "Towneley Park"
    nearTown: z.string().optional(),         // "Truro"
    terrain: z.enum([
      'urban',       // streets, housing estates, town parks
      'parkland',    // mixed park / urban-park / school grounds
      'forest',      // woodland, plantation
      'moorland',    // open hill, fells
      'mtbo',        // mountain bike orienteering
      'mixed',       // combinations
    ]),
    surveyYear: z.number().optional(),
    surveyor: z.string().optional(),
    scale: z.string().optional(),            // "1:7500", "1:10000"
    contourInterval: z.string().optional(),  // "5m"
    permanentCourse: z.boolean().optional(), // has a POC
    coords: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
    // The map image itself is no longer rendered on the public site -
    // copyright sits with the individual surveyors. Field kept (optional)
    // for internal records and future use if licensing changes.
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    // Direct link to this specific area's RouteGadget entry (preferred).
    // If unset we fall back to the public RG index.
    routeGadgetUrl: z.string().optional(),
    // British Orienteering's GoOrienteering URL for this area's
    // Permanent Orienteering Course (POC). Only set when the area has
    // a live POC listed on goorienteering.org.uk - e.g.
    // https://www.goorienteering.org.uk/course/peel-park. When set, a
    // "Permanent course on GoOrienteering →" button appears on the map
    // detail page. Leave blank for areas where the POC is in
    // development or not yet on goorienteering.org.uk (committee can
    // still tick permanentCourse: true so we can advertise it as
    // coming soon).
    permanentCourseUrl: z.string().optional(),
    summary: z.string(),                     // one-line description for cards
    draft: z.boolean().optional(),
  }),
});

// ─────── Info pages collection
// Sub-pages of the Information hub - policies, privacy, etc.
// Each .md file becomes /information/<slug>
const infoPages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/cornwall-content/info-pages' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    section: z.enum(['governance', 'safety', 'participation', 'members', 'admin', 'tips']).optional(),
    order: z.number().optional(),
    lastReviewed: z.date().optional(),
    draft: z.boolean().optional(),
    /** Use the full-width layout (no right sidebar, sibling links collapsed
     *  into a small dropdown). Use for pages with wide tables that need the
     *  whole content area - e.g. POC course tables. */
    wideLayout: z.boolean().optional(),
    /** Optional file downloads attached to this info page - PDFs, Word
     *  docs, spreadsheets, etc. Rendered as a styled list at the bottom. */
    attachments: z.array(z.object({
      label: z.string(),
      file: z.string(),
      type: z.enum(['pdf', 'docx', 'xlsx', 'csv', 'image', 'other']).optional(),
    })).optional(),
    /** When true, render a small overview Google Map above the page body
     *  showing every mapped area with `permanentCourse: true`. Used on
     *  /information/permanent-orienteering-courses so visitors can see at
     *  a glance where the POCs are. Pin click → POC area detail page. */
    pocMap: z.boolean().optional(),
    /** Optional two-column card block, rendered above the markdown body
     *  when present. Used on /information/types-of-orienteering to split
     *  the format guide into Terrain (left) and Course style (right)
     *  axes. Left blank on every other info page so they keep the
     *  standard single-column prose layout. */
    twoColumn: z.object({
      leftHeading: z.string(),
      leftBlurb: z.string().optional(),
      leftCards: z.array(z.object({
        title: z.string(),
        body: z.string(),
        /** Optional thumbnail image rendered above the card title.
         *  Andy intends to add map snippets here to illustrate terrain
         *  types - left blank on every existing card today. */
        thumbnail: z.string().optional(),
        thumbnailAlt: z.string().optional(),
      })),
      rightHeading: z.string(),
      rightBlurb: z.string().optional(),
      rightCards: z.array(z.object({
        title: z.string(),
        body: z.string(),
        thumbnail: z.string().optional(),
        thumbnailAlt: z.string().optional(),
      })),
    }).optional(),
  }),
});

// ─────── Announcements collection
// Banner messages displayed on the homepage between two dates. Committee
// uses these for last-minute event changes, weather warnings, AGM notices,
// etc. The banner only renders if `today` is between validFrom and validUntil
// AND `published: true`. Once the period elapses the banner disappears
// automatically - but the announcement record stays for future reference.
const announcements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/cornwall-content/announcements' }),
  schema: z.object({
    title: z.string(),               // e.g. "Brun Valley parking change"
    message: z.string(),             // 1–2 sentences shown on the banner
    validFrom: z.date(),
    validUntil: z.date(),
    severity: z.enum(['info', 'warning', 'urgent']).default('info'),
    link: z.string().optional(),     // optional URL the banner links to
    linkLabel: z.string().optional(),// custom label for the link
    published: z.boolean().default(true),
  }),
});

// ─────── Videos collection
// Each .md file is one video. We don't host any video content ourselves -
// every entry points at a YouTube URL and the page embeds it via iframe.
// This keeps the repo small, bandwidth cost zero, and gives editors a
// familiar place to manage uploads (their YouTube account).
const videos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/cornwall-content/videos' }),
  schema: z.object({
    title: z.string(),
    /** YouTube URL or 11-character video ID. The CMS accepts the full
     *  share URL (https://youtu.be/XXX or https://www.youtube.com/watch?v=XXX)
     *  and we extract the ID at render time - see src/lib/youtube.ts. */
    youtube: z.string(),
    date: z.date(),
    /** 1-line standfirst shown on the /videos library cards and at the
     *  top of the embed on the dedicated video page. */
    summary: z.string(),
    /** Optional longer markdown description - context, what was filmed,
     *  who's in it. Rendered below the embed on individual video pages. */
    description: z.string().optional(),
    /** Pin to the top of the /videos library AND surface as the featured
     *  video on the Training page. Tick on whichever single video the
     *  committee wants currently promoted. */
    featured: z.boolean().optional(),
    /** Hide from every public page without deleting (mirror of the news
     *  / events `hidden` toggle). */
    hidden: z.boolean().optional(),
  }),
});

export const collections = { events, news, maps, infoPages, announcements, videos };
