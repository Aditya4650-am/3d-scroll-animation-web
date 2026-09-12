# Deep Space — Cinematic Scroll-Driven Spaceship Hero

A production-ready, scroll-controlled frame-by-frame hero. Scrolling moves a
futuristic spaceship smoothly through deep space using the **actual frame
images** provided in the repository's source ZIP —
`Spaceship_flying_through_deep_space_202608272353_frames (1).zip`
(8 frames at 1280×720 / 16:9).

The site contains **no other visual content** — no text, nav, buttons, cards,
or decoration. It is just the cinematic spaceship animation.

## How it works

- **Sticky fullscreen hero** — a `position: sticky; top: 0; height: 100vh`
  canvas is pinned to the viewport while the user scrolls a 700vh timeline
  (`ScrollTrigger` `progress` maps to the frame index).
- **Smooth scroll** — GSAP + GSAP ScrollTrigger + Lenis, all driven from a
  single `requestAnimationFrame` loop. The raw scroll progress is eased into a
  floating frame index (`SMOOTHING`), so the result feels like a camera move,
  never a slideshow.
- **Canvas rendering** — frames are drawn onto an opaque `<canvas>` (no
  `<img>` swapping), with `devicePixelRatio` capped at 2, cover-fit ("object-fit:
  cover") scaling that never distorts the 16:9 spacecraft, and no redundant
  repaints.
- **Deterministic frame mapping** — `progress * (totalFrames - 1)`, clamped to
  `[0, totalFrames - 1]`, with NaN/negative guards. The final frame always
  shows at scroll end.
- **Progressive preloading** — frame 1 loads immediately and fades in; the rest
  load in the background with a priority window near the scroll position.
  Failed frames degrade gracefully (no blank frames, no crash).
- **Reduced motion** — respects `prefers-reduced-motion` and shows a static
  representative frame.

## Frames

Frame assets are **derived automatically** from the source ZIP at build time by
`scripts/extract-frames.mjs`:

1. Extracts all `.png` frames into `public/frames/`.
2. Sorts them with **natural numeric ordering** (`frame_001`, `frame_002`, …)
   so ordering is never wrong.
3. Writes `src/components/SpaceshipScrollHero/frames.js` containing the
   resolved filenames and total frame count (auto-detected).

The `public/frames/` output and generated `frames.js` are git-ignored (they are
derived artifacts). The ZIP in the repo root is the canonical source.

## Getting started

```bash
npm install      # installs vite, react, gsap, lenis
npm run dev      # extracts frames, starts the dev server
npm run build    # production build (frames copied into dist/frames)
npm run preview  # preview the production build
```

## Structure

```
scripts/
  extract-frames.mjs              # derive frames + manifest from the ZIP
public/
  frames/                         # extracted PNGs (generated, git-ignored)
src/
  components/SpaceshipScrollHero/
    SpaceshipScrollHero.jsx       # the sticky canvas hero + scroll wiring
    SpaceshipScrollHero.css       # cinematic styling + vignette
    frameLoader.js                # smart preloader / frame manager
    frames.js                     # auto-generated manifest (git-ignored)
  App.jsx
  main.jsx
  index.css
```
