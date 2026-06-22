// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';

// https://astro.build/config
export default defineConfig({
  // The canonical URL for the site. Used by:
  //  - <link rel="canonical"> in Layout.astro
  //  - Open Graph / Twitter meta tags
  //  - @astrojs/sitemap to build absolute URLs in sitemap.xml
  // If you point a different domain at the site, change this and redeploy.
  site: 'https://cornwallorienteering.org.uk',

  // Trailing-slash URLs are friendlier for static hosts but we standardise
  // on no-trailing-slash to match the existing KERNO URL style. Keep this
  // consistent with how internal <a href> values are written.
  trailingSlash: 'never',

  integrations: [
    sitemap({
      // Drop the CMS admin and the search page from the sitemap - neither
      // is useful to search engines.
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/search'),

      // Sensible defaults; engines treat these as hints, not commands.
      changefreq: 'weekly',
      priority: 0.7,

      // Per-URL overrides - homepage gets top priority.
      serialize(item) {
        if (item.url === 'https://cornwallorienteering.org.uk/') {
          item.priority = 1.0;
          item.changefreq = 'daily';
        }
        if (item.url.includes('/events')) {
          item.changefreq = 'daily';
          item.priority = 0.9;
        }
        if (item.url.includes('/news')) {
          item.changefreq = 'weekly';
          item.priority = 0.8;
        }
        return item;
      },
    }),
  ],

  // Keep image optimisation enabled (default in Astro 5+) - runs at build,
  // does nothing at runtime, makes the deployed site faster.

  // Markdown rendering - adds target="_blank" + rel="noopener noreferrer"
  // to any link in markdown content (news bodies, info-page bodies, event
  // bodies, etc) where the URL is to a different domain. Internal links
  // (/events, /maps, /news/...) keep their default behaviour and open in
  // the same tab. Saves the committee from having to remember any HTML -
  // just use [link text](https://example.com) in the CMS and the link
  // auto-opens in a new window.
  markdown: {
    rehypePlugins: [
      [rehypeExternalLinks, {
        target: '_blank',
        rel: ['noopener', 'noreferrer'],
        // Treat anything starting with /, #, mailto: or tel: as internal.
        // Astro applies the plugin only to absolute http/https links by
        // default, so this is mostly belt-and-braces.
        protocols: ['http', 'https'],
      }],
    ],
  },
});
