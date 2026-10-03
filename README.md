# Hilton Renewables — Cinematic Scroll Site (v3)

A single-page, scroll-driven brand experience for Hilton Renewables. Vanilla
HTML/CSS/JS with GSAP + ScrollTrigger + Lenis, **no build step and no
dependencies to install** — every library, font and image is vendored locally.

## Run it

Open `index.html` directly, or (recommended, so the frame sequence loads cleanly):

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

Deploy by copying the whole folder to any static host (Netlify, Cloudflare
Pages, S3, IIS, Apache, nginx). Nothing server-side is required.

## What's on the page

This version uses **two** scroll films. `Hilton Renewebles intro.mp4` drives the
opening journey (sun → earth → descent through cloud → solar farm → panels) and
the panel video drives the product reveal below it.

**Note on the source video:** a burned-in yellow "HILTON RENEWABLES" caption
appears in the original from 5.0 s onward. The frame build stops at 5.0 s so the
film stays clean, and the brand moment is handled by the site's own logo reveal
in the finale. If a caption-free master is supplied later, raise `--max-frames`
and bump `CONFIG.films.a.count`.

New in v3, beyond v2: a **free-consultation booking** section, a **parent
company** block for Hilton Infotech, **nav scroll-spy**, **conversion tracking**
(GA4 / GTM `dataLayer` events) and **map directions** links on both offices.

| # | Section | Technique |
|---|---------|-----------|
| 01 | Cinematic hero journey | 150-frame WebP sequence from the intro video, scrubbed on `<canvas>`; 5 chapters: hero → one planet → down to earth → at scale → to the cell |
| 02 | Module architecture | second 150-frame sequence from `Solar Panel Video.mp4`: exploded layers with callouts, cell macro, sealed module |
| 03 | From sunlight to power | animated SVG energy path: sun → array → inverter → loads → grid |
| 05 | Solar Solutions | 7 cinematic cards, 3D tilt on hover |
| 06 | Solar EPC, step by step | scroll-linked 7-step timeline with synced imagery |
| 07 | Scale | pinned aerial with parallax + ISO badges |
| 08 | About | word-by-word manifesto reveal |
| 09 | Performance & technology | animated counters + capability tiles |
| 10 | Project experience | horizontal scroll gallery |
| 11 | Client trust | dual auto-scrolling logo marquees, colour on hover |
| 12 | Calculator + quotation | savings estimate that prefills the quote form |
| 13 | Supported by | Hilton Infotech parent-company block |
| 18 | Consultation | free-consultation booking with date/time slot, WhatsApp or email hand-off |
| 13 | Product catalog | floating 3D module, links to the PDF |
| 14 | Finale | sunset → logo reveal, CTAs |
|    | Contact + footer | offices, phone, email, quick links |

Plus: sticky transparent nav (appears after the film, flips to light over light
sections), mobile menu, scroll progress bar, custom cursor, magnetic buttons,
floating WhatsApp, mobile sticky action bar.

## Editing

**Everything configurable lives at the top of `assets/js/main.js` in `CONFIG`:**

```js
CONFIG.films.a.count   // hero journey frames in assets/frames  (150)
CONFIG.films.b.count   // module reveal frames in assets/frames2 (150)
CONFIG.whatsapp        // WhatsApp number used by every WhatsApp CTA
CONFIG.email           // fallback email for quotation submissions
CONFIG.api             // Spring Boot endpoints — see "Backend" below
CONFIG.calc            // tariffs, generation per kW, roof area per kW, savings factor
```

**Colours and type** are CSS custom properties at the top of
`assets/css/style.css` (`--ink`, `--navy-800`, `--blue`, `--green`, …).

**Copy** is plain HTML in `index.html` — each section is commented and numbered.

### Numbers on the page

The counters use only facts taken from the company catalog: 3 ISO
certifications (9001:2015 / 45001:2018 / 14001:2015), 7 service divisions,
13+ industry clients (the logos shown), 25-year design horizon, 2 offices.
Replace them in the `#counters` block once verified installation/MW figures are
approved — the requirements doc is explicit that placeholder numbers must not
be published.

## Conversion tracking

`track(event, params)` pushes to `window.dataLayer` (and `gtag` when present), so
adding a GA4 or GTM snippet to `<head>` is the only integration step. Events
fired: `calculator_started`, `calculator_completed`, `quotation_submitted`,
`consultation_submitted`, `whatsapp_clicked`, `phone_clicked`, `catalog_viewed`.
Any element can fire one by adding `data-track="event_name"`.

## Backend (optional)

The calculator and quotation form work fully client-side. To connect the
Spring Boot API from the requirements document, set:

```js
api: {
  calculations: '/api/v1/solar-calculations',
  quotations:   '/api/v1/quotations'
}
```

Request/response shapes match the spec (`monthlyBill`, `propertyType`, `city`,
`pinCode`, `roofAreaSqFt` → `recommendedCapacityKw`, `monthlyGenerationMin/Max`,
…). If a call fails the page silently falls back to local maths, so the lead is
never lost. Without an API, submitting the quote generates a reference
(`HR-QT-YYYY-NNNNNN`) and offers WhatsApp / email hand-off.

The consultation form follows the same pattern (`HR-CS-YYYY-NNNNNN` reference,
WhatsApp or email hand-off) and is ready to point at
`POST /api/v1/consultations`.

Server-side work still required before production: CAPTCHA verification,
rate limiting, file upload for electricity bills, email notification, and lead
storage — all specified in `solar_company_website_complete_requirements.md`.

The Hilton Infotech block has no outbound link — add the parent company's URL to
the `#group` section when it is confirmed.

## Rebuilding the film

```bash
# 01 hero journey — stop before the burned-in caption at 5.0 s (150 frames @ 30fps)
python3 tools/build-frames.py "path/to/Hilton Renewebles intro.mp4" --out frames \
    --fps 30 --width 1280 --quality 76 --max-frames 150 --poster film-poster.jpg

# 02 product reveal (the panel video's last ~25% is a white logo outro,
#    so it is cut at frame 196 and subsampled to 150)
python3 tools/build-frames.py "path/to/Solar Panel Video.mp4" --out frames2 \
    --width 1120 --quality 78 --max-frames 196 --pick 150 --poster film2-poster.jpg
```

Each run prints its frame count — put it in the matching `CONFIG.films.*.count`.
On phones the hero film switches from letterbox to full-bleed automatically
(`fillPortrait`), so 16:9 footage still fills a 9:19.5 screen.

## Accessibility & performance

- `prefers-reduced-motion` is honoured: pins, scrubs and the custom cursor are
  disabled and every section renders as a static page.
- Keyboard navigable, visible focus rings, labelled form fields, alt text on
  every image, skip link, semantic landmarks.
- Total page weight ≈ 17 MB, of which 12.3 MB is the two frame sequences. Only
  the first 34 frames of the hero film block the preloader (~2 s); the rest
  stream in the background and the second sequence starts loading only when the
  reader is roughly one screen away from it.
- Fonts (Manrope, Inter) are self-hosted woff2, subset to latin.

## Files

```
index.html
assets/
  css/style.css        design system + all sections
  js/main.js           scroll engine, calculator, quote form
  frames/f0001…f0150.webp    hero journey (intro video)
  frames2/f0001…f0150.webp   module reveal (Solar Panel Video.mp4)
  img/                 photography, 3D renders, logo variants
  logos/               client logos
  fonts/               self-hosted woff2
  vendor/              gsap, ScrollTrigger, lenis
catalog/               product catalog PDF
tools/build-frames.py  regenerates the frame sequence
```
