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

## Deploying

Fully static — push to a GitHub repo and enable Pages (Settings → Pages →
Deploy from branch), or drag the folder onto Netlify. No build command
needed either way.
