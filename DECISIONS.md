# KERNO website - decisions and reasoning

A running log of the choices made building the Cornwall Orienteering Club (KERNO)
site, and why. Newest sections at the bottom.

## Foundations

- **Built on the PFO Astro template.** Rather than start from scratch, the site
  reuses the Pendle Forest Orienteers Astro codebase (same author). It's a fast,
  static, git-based site that already had the right structure for an orienteering
  club, so it gave us a big head start.
- **Colours taken from the KERNO logo** (black, white, amber-gold `#feb92a`).
  Defined once as CSS variables in `src/layouts/Layout.astro` so the whole site
  themes from one place.
- **Hosting: Cloudflare (via GitHub).** Free private repos and free builds, which
  avoids the Netlify build-credit cost. A small `wrangler.jsonc` serves the built
  `dist/` as static assets. (`netlify.toml` / `netlify/functions` remain in the
  repo but only run if deployed to Netlify.)

## Navigation

- **Only Home, News, Fixtures and Results are real pages on the new site** during
  the preview; **everything else links out to the current KERNO site**
  (`cornwallorienteering.org.uk`). This let us show a credible demo without
  implying the whole site was finished. As inner pages are now being built, these
  links can be pointed back to the new internal pages (see "next steps").
- **Photos** is not a nav page; it's the club Flickr, surfaced on the home page
  and in the footer instead.
- **"Events" is labelled "Fixtures"** throughout, to match KERNO's own wording.

## Content cleanup

- **All PFO-specific content and photos were removed** (events, news, maps,
  results archive, committee, photos, PDFs, region names, social handles, calendar
  feed, contact emailer). The site reads as Cornwall throughout, with zero "PFO",
  "Pendle" or "East Lancashire" references.
- **Em dashes removed** from all site copy and config, per preference (replaced
  with commas or hyphens).
- **Hero filler backdrop:** the home hero has a dark-to-gold gradient behind it so
  the light heading stays legible even with no photo; a photo simply layers on top.

## Home page

- The "Take part anytime" section was rebuilt around what KERNO actually offers
  (permanent courses, the intro video, map/control PDFs, code of conduct,
  safeguarding) rather than PFO's MapRun/POC set.
- The intro **video is embedded** in the "Interested in knowing more?" box,
  sitting beside the text as a small player.

## CMS

- **Decided: Decap CMS on Netlify.** Free, git-based, writes to the same
  markdown/JSON the site already uses, and Rich Text mode means editors never see
  markdown. Chosen on Netlify (rather than Cloudflare) because Netlify Identity +
  Git Gateway give one-click **email invites** for the committee, with no GitHub
  accounts and no OAuth worker to build.
- Options weighed: CloudCannon (nicer, but per-section permissions are ~$300/mo,
  too costly for a club) and Pages CMS (also free, hosted GitHub auth, email
  invites, no permissions yet). Decap-on-Netlify won on being the most proven
  setup with the simplest committee onboarding.
- **Implication: host on Netlify.** Deploying to Netlify (instead of, or as well
  as, Cloudflare) also makes the Netlify Functions run, which means the **contact
  form sends email** and the **neighbouring-clubs live table** works, clearing two
  earlier caveats.
- **Config status:** `public/admin/config.yml` backend is `git-gateway`, all
  site-settings JSON files are mapped, and the collection folders now point at
  `src/cornwall-content/*`. To go live: in Netlify, enable Identity, enable Git
  Gateway, then invite committee members by email.

## Page build-out (this phase)

Goal: turn the link-out pages into real pages, fix inherited PFO inaccuracies, and
split overly long pages.

- **Corrected factual errors** carried over from the template's data files:
  - Founding date set to **1982** (was "1960s").
  - **SWOA** (South West Orienteering Association) everywhere it previously said
    NWOA.
  - **KERNO club membership is free**; you pay only British Orienteering's fee.
    Earlier copy wrongly stated a £19/£8 club fee.
  - Membership Secretary corrected to **Steve Beech** (was a PFO name); join link
    points to British Orienteering's generic join page (PFO's club ID removed).
  - Geography rewritten for Cornwall (the rebrand had left "Cornwall, Cornwall,
    Cornwall, Darwen ...").
- **Split the giant "What is Orienteering?" page.** KERNO's single ~3,000-word
  page is broken into focused, reusable info-pages: courses & colour grading, age
  classes, electronic punching (SI), reading the map, and top tips. The friendly
  `/newcomers` hub keeps the overview (how it works, what to bring, first event,
  FAQ).
- **New pages added that KERNO didn't have:** Juniors & families, Get involved
  (volunteering), Permanent courses (its own page), Privacy, Event-day safety,
  Resources for organisers, and Useful links.
- **Mapped areas** seeded with four venues: Tehidy Country Park, St Clement Woods
  (Idless), Lanhydrock, and Penrose & Loe Pool.

### Things to verify / follow up

- **Map coordinates are approximate** placeholders and should be checked against
  the real venue locations before launch.
- **Permanent course count:** KERNO's About page says "three" but its Areas page
  details only **two** (Tehidy, Idless). We've used the two detailed ones; confirm
  whether a third exists.
- **Contact form** won't send email on Cloudflare (it relies on a Netlify
  function). Needs a `mailto:` link or a form service before launch.
- **Newcomers hub linking:** the split reference pages are discoverable via the
  Information hub and cross-links; explicit "go deeper" links could be added to the
  `/newcomers` page.
- **Repointing nav/footer:** once the committee approves the inner pages, the
  external "About Us", Membership, Areas etc. links can be switched to the new
  internal pages.

## Demo routing + neighbouring club (latest)

- **All navigation now routes to the live KERNO site.** For the committee demo,
  the header nav (News, Fixtures, Results, About Us), the footer, and the home
  page's calls-to-action and event/news cards all link out to
  `cornwallorienteering.org.uk`. Only the Home page itself stays on the new site.
  The inner pages we built remain in the repo, ready to switch back to internal
  links once the committee approves going live.
- **Neighbouring club feed set to all 8 SWOA clubs** (Devon, Wimborne, Wessex, Quantock, Bristol/BOK, North Glos, North Wilts, Sarum). Replicated PFO's method: the events
  page pulls British Orienteering's per-association fixtures feed and filters it
  for neighbouring clubs. Cornwall and Devon are both in SWOA, so the feed is now
  `fixturesjson.php?assoc=SWOA` and the filter is the `DEVON` club code (verified
  against the live feed). Configured in `src/data/neighbouring-clubs.ts` and
  `netlify/functions/neighbour-events.mjs`.
  - **Caveat:** that live feed runs through a Netlify Function. On Cloudflare it
    won't execute, so the Fixtures page shows the static Devon fallback link
    instead of the live table. To get the live Devon table on Cloudflare, add a
    Cloudflare Pages Function (or a build-time fetch) using the same SWOA feed.

## CMS engine switched to Sveltia (trial)

We swapped the CMS from Decap to Sveltia CMS to trial a simpler editor. Sveltia
is a drop-in successor to Decap and reads the same `public/admin/config.yml`.
Three deliberate changes came with the switch, because Sveltia does not yet
support some Decap-only features:

- **Backend: git-gateway -> GitHub.** Sveltia does not support Netlify's
  deprecated Git Gateway, so `config.yml` now uses `backend: github` pointing at
  `kylegmassiah-creator/KERNO`. Editors log in with a (free) GitHub account after
  being invited to the repo with the Write role, instead of Netlify email
  invites. To enable login, add a GitHub OAuth provider on the host (on Netlify:
  Site configuration -> Access & security -> OAuth -> install GitHub; this is the
  plain OAuth app, not Netlify Identity).
- **Editorial workflow removed.** Sveltia has not implemented
  `publish_mode: editorial_workflow` yet (pre-1.0), so it was removed and edits
  publish directly. The per-item "Draft" tick-boxes on News, Maps and Info pages
  still work.
- **Per-user role access removed.** The old role-based collection filter in
  `src/pages/admin/index.astro` relied on Netlify Identity roles. With the GitHub
  backend, anyone with repo Write access edits all collections. The admin page is
  now just the Sveltia loader.
- **Custom Google Maps pin-picker replaced.** Sveltia does not support Decap
  custom widgets yet. The event `coordsGoogle` field (widget: google-map, which
  was only a string alias storing "lat,lng") is now a plain string field, and
  `coordsMethod` defaults to "paste". Stored data format is unchanged, so
  `src/lib/coords.ts` and existing content need no migration.
  `public/admin/google-map-widget.js` is left in the repo, unused.

Verified with a clean `npm install` + `npm run build` (36 pages, Pagefind index
built, no errors). What is NOT yet done: wiring the GitHub OAuth provider on the
host so committee members can actually sign in at /admin.
