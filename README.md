# Bhanu Singh — Portfolio

Personal portfolio site for Bhanu Singh — game designer, interactive designer,
filmmaker, and Unreal Engine virtual production artist. Plain HTML/CSS/JS,
no framework, no build step — fast to load, easy to edit.

Live structure:

```
index.html            Home — intro, selected work, thesis spotlight
projects.html          Work grid (8 projects)
projects/*.html         One page per project
about.html               Bio, experience, skills, résumé
research.html             Research index — ongoing MFA thesis + coursework
research/*.html            One page per research piece
contact.html                Email + LinkedIn
css/style.css                 Global styles, tokens, layout, components
css/street.css                 Home hero street-scene styles (currently unused
                                on the live page — kept for a future revisit)
js/main.js                      Nav toggle, footer year
js/analytics.js                  Visitor analytics (Umami), see below
js/street-scene.js               Interactive street-scene behavior (unused,
                                  same reason as above)
assets/                            Images, video, résumé, research docs
```

## Running it locally

No build step — just serve the folder so relative paths and fonts resolve:

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`.

## Design

Dark editorial theme — near-black background, bold Inter grotesk type, warm
amber accent used deliberately to call out credentials and achievements in
running text (`.hl`, `.tag--award` in `css/style.css`). Structure follows
hirotos.com; color/highlight treatment is closer to vebhuv.com.

## Analytics

`js/analytics.js` (loaded on every page) sends visit data to
[Umami Cloud](https://cloud.umami.is). It stays switched off until a Website ID
is set:

1. Sign up at cloud.umami.is → **Add website** → enter the live domain.
2. Copy the **Website ID** (Settings → Websites → Edit) into
   `UMAMI_WEBSITE_ID` at the top of `js/analytics.js`. Optionally list the live
   hostnames in `UMAMI_DOMAINS` so preview/staging URLs aren't counted.
3. Open the live site once with `?notrack` on the URL so your own visits
   are ignored in that browser (`?track` undoes it).

Umami shows page views, visitors, visit duration, bounce rate, referrers,
countries and devices on its own. The **Sessions** tab lists each visitor's
path through the site with every event below in order. The **Events** tab
totals them, broken down by property.

| Event | When | Properties |
|---|---|---|
| `page-exit` | page hidden, closed or navigated away | `page`, `engaged_seconds`, `time_bucket`, `max_scroll` |
| `scroll-depth` | 25/50/75/100 % reached | `page`, `depth` |
| `section-view` | an `h2` section on screen 1s+ | `page`, `section` |
| `card-view` | a project/research card on screen 1s+ | `page`, `card`, `position` |
| `card-click` | a card is opened | `page`, `card` |
| `media-view` | an image/video on screen 1.5s+ | `page`, `type`, `name` (caption or alt text) |
| `video-play` / `video-progress` | first play, then 25/50/75/100 % | `page`, `name`, `percent` |
| `email-click`, `resume-download`, `file-download`, `outbound-click` | link clicks | `page`, plus `file` / `url` |

Engaged time counts only while the tab is visible and the visitor has been
active in the last minute (or a video is playing). If someone leaves the tab
and comes back, `page-exit` fires again with the running total, so take the
latest value for that page view. Add `?analytics-debug` to a URL to log
events to the browser console. Nothing is ever sent from localhost.

## Deploying

Fully static — push to a GitHub repo and enable Pages (Settings → Pages →
Deploy from branch), or drag the folder onto Netlify. No build command
needed either way.
