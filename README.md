# Loco Acres Farm

Multi-page website for Loco Acres Farm — Joe & Margie Kill's family farm in Millbury, Ohio.
Raw local honey; chicken, duck, turkey and goose eggs; freezer meats; live poultry; and holiday
birds by preorder.

- **Owners:** Joe & Margie Kill
- **Address:** 1760 Woodville Rd, Millbury, OH 43447
- **Phone:** 419-917-1706 · 419-349-2788
- **Hours:** Open daily, 10 am – 5 pm
- **Ordering:** Local pickup only, no shipping. Market pricing — call for today's prices.

**Live at:** https://locoacresfarm.com

## Pages

Each page targets its own local search intent, with its own title, meta description, H1 and FAQs.

| URL | Targets |
|---|---|
| `/` | Brand — "Loco Acres Farm" |
| `/raw-honey-millbury-ohio/` | raw honey near me, local honey Millbury |
| `/farm-fresh-eggs-millbury-ohio/` | farm fresh eggs, duck eggs, goose eggs near me |
| `/freezer-meats-millbury-ohio/` | freezer beef, farm raised turkey/chicken |
| `/live-poultry-for-sale-millbury-ohio/` | live chickens/ducks/geese for sale near me |
| `/holiday-turkey-goose-duck-preorder/` | Thanksgiving turkey, Christmas goose preorder |
| `/farm-stand-hours-directions/` | farm stand near me, hours, directions, payment |

## SEO

- **LocalBusiness + Farm schema** on every page — address, geo coordinates, daily opening hours,
  payment methods, and the surrounding towns served (Toledo, Oregon, Northwood, Walbridge,
  Perrysburg, Genoa, Woodville, Wood County).
- **Product schema** on each product page, **FAQPage schema** on all six subpages,
  **BreadcrumbList** on subpages, **WebSite** on the homepage.
- `sitemap.xml` and `robots.txt` at the root.
- Canonical URLs, Open Graph and Twitter card tags, geo meta tags.
- Internal linking: shared nav, breadcrumbs, a cross-link block on every subpage, and
  "read more" links from each homepage section into its deep page.

## Structure

- `index.html` — homepage
- `<page-slug>/index.html` — one folder per page, so URLs are clean with no `.html`
- `styles.css` — shared stylesheet (was inline; now cached across all pages)
- `logo.png` / `logo-web.png` — the farm's logo
- `art.png` / `art-web.jpg` — the farm scene artwork
- `flock.webp` — real photo of the farm's young flock
- `img/pay/` — payment method logos
- `favicon.ico`, `favicon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` —
  favicon set cropped from the farm's own barn-and-sunrise emblem
- `site.webmanifest` — PWA manifest (name, theme color, icons)
- `CNAME` — custom domain (locoacresfarm.com), kept in the repo so a push cannot drop it

No build step, no framework, no JavaScript. Open `index.html` in a browser or deploy the folder
as-is to any static host.
