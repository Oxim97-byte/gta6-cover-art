# Sunset Strip — GTA-style Cover Studio

[![Cover Art](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/Oxim97-byte/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/Oxim97-byte/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn 1–4 of your photos into a poster that looks like it belongs on a video-game
cover: a big condensed title, a neon script subtitle, a synthwave sun, palm
silhouettes, a skyline, halftone dots and film grain — all drawn in code, so the
cover is always crisp at any export size.

## How it works

1. **Photos** — load the five sample photos or drop in your own (up to 4). Click a
   thumbnail to place that photo in the selected panel; one button fills every
   panel with the same photo.
2. **Layout** — eight arrangements: Hero, Duo, Trio, Quad, Nine (3×3), Tilted
   (overlapping snapshots), Full-bleed and Story (vertical). Click a panel to
   select it, drag inside it to slide its photo, and use the zoom slider to
   reframe it.
3. **Grade** — six sunset looks: Vice Sunset, Neon Nights, Palm Gold, Noir Teal,
   Candy Pop and Mono Ink, with a strength slider and a film-grain toggle.
4. **Caption** — an Anton title that auto-fits (white or grade-gradient fill,
   thick black outline, hard shadow), a Pacifico neon subtitle, a sub-caption,
   a gold badge ribbon and a five-star heat meter. Title size and position are
   sliders.
5. **Export** — full-resolution PNG at 1080×1080, 1080×1350 or 1920×1080, or all
   three at once, as `cover-<WxH>.png`.

Undo/redo works from the buttons or Ctrl+Z / Ctrl+Y. Panels left without a photo
are filled with a procedural vector scene (gradient sky, slatted sun, skyline and
palms) in the current grade, so a cover never looks empty.

## The look

Everything decorative is drawn with canvas code — no stock artwork, no game
logos, no game fonts. The typefaces are Anton and Pacifico, both under the SIL
Open Font License, vendored in `app/fonts/` with their licence texts. The five
sample photos in `app/samples/` were generated for this entry with an image
model; the two kit samples (`boulevard.jpg`, `pier.jpg`) are the starter kit's.

## Run it

```sh
node serve.ts   # serves app/ on http://localhost:8080
```

The app is plain static files under `app/` — no build step, no network requests
while it runs. Screenshot scenes are driven by `?shot=cover` and `?shot=editor`
(see `shots.json`).
