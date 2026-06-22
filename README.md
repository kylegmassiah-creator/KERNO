# Cornwall Orienteering Club (KERNO) website

Static site built with [Astro](https://astro.build) for Cornwall Orienteering
Club. Content lives in Markdown collections under `src/cornwall-content/`
(events, news, maps, info pages, announcements, videos) and editable copy in
`src/data/*.json`. Site-wide colours come from the club logo (black, white and
gold) and are defined as CSS variables in `src/layouts/Layout.astro`.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
```

## Build

```bash
npm run build    # static output in dist/, plus Pagefind search index
npm run preview
```

## Structure

- `src/pages/` - routes (home, fixtures, results, news, about, etc.)
- `src/components/` - Header, Footer, PageHero, EventCalendar, …
- `src/cornwall-content/` - Markdown content collections
- `src/data/` - editable text, committee list, page hero photos
- `public/assets/` - logo and shared images
