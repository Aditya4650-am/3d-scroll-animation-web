import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { FRAME_FILENAMES, TOTAL_FRAMES } from './frames.js';
import { FrameManager } from './frameLoader.js';
import './SpaceshipScrollHero.css';

gsap.registerPlugin(ScrollTrigger);

// ---- Tuning constants -------------------------------------------------------
const PRELOAD_WINDOW = 4; // frames loaded eagerly around the scroll position
const DPR_CAP = 2; // cap device pixel ratio to protect GPU/CPU
// Smoothing factor for scroll -> frame interpolation. 0.12 yields a smooth,
// camera-like ease across frames while still tracking the wheel accurately.
const SMOOTHING = 0.12;

/**
 * The ONLY visual content on the page: a sticky, fullscreen cinematic view of
 * the provided spaceship frame sequence, driven by scroll.
 *
 * Guaranteed first paint: the real first frame is also rendered as a plain
 * <img> poster (loaded natively by the browser, no JS required). When the
 * canvas is ready it draws frame 0, then the canvas fades in on top and the
 * poster fades out. Even in a constrained/iframe environment the spaceship is
 * always visible from the start.
 */
export default function SpaceshipScrollHero() {
  const wrapperRef = useRef(null);
  const stickyRef = useRef(null);
  const canvasRef = useRef(null);
  const posterRef = useRef(null);
  const vignetteRef = useRef(null);

  // Animation state lives entirely in refs — never in React state — so a
  // single scroll event triggers zero re-renders.
  const rafRef = useRef(null);
  const frameIndexRef = useRef(0); // smoothed/displayed frame index
  const targetIndexRef = useRef(0); // raw target from scroll progress
  const lastDrawIndexRef = useRef(-1);
  const lastProgressRef = useRef(0);
  const ctxRef = useRef(null);
  const fmRef = useRef(null);
  const lenisRef = useRef(null);
  const stRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const srcWRef = useRef(0);
  const srcHRef = useRef(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const canvas = canvasRef.current;
    const poster = posterRef.current;
    const ctx = canvas.getContext('2d', {
      alpha: false, // opaque canvas -> avoids compositing cost
    });
    ctxRef.current = ctx;

    const baseURL = import.meta.env.BASE_URL || '/';
    const sources = FRAME_FILENAMES.map((f) => `${baseURL}frames/${f}`);

    const fm = new FrameManager(sources);
    fmRef.current = fm;

    // ---------- canvas sizing / DPI handling ----------
    const resizeCanvas = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.round(vw * dpr));
      const h = Math.max(1, Math.round(vh * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Reset transform for cover-fitting by the draw step.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    };
    resizeCanvas(); // size the canvas correctly immediately on mount

    // ---------- draw ----------
    const drawFrame = (index) => {
      const img = fm.getFrame(index);
      const source = img ? index : fm.nearestReady(index);
      const frame = source !== null ? fm.getFrame(source) : null;

      const cw = window.innerWidth;
      const ch = window.innerHeight;

      if (!frame) {
        // Nothing decoded yet: keep the canvas opaque black.
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cw, ch);
        return;
      }

      // object-fit "cover": never stretch, never distort, preserve 16:9.
      const sx = srcWRef.current || frame.naturalWidth;
      const sy = srcHRef.current || frame.naturalHeight;
      const scale = Math.max(cw / sx, ch / sy);
      const dw = sx * scale;
      const dh = sy * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(frame, dx, dy, dw, dh);
    };

    // Hand the visuals over to the canvas once the first frame is decoded.
    const activateCanvas = () => {
      if (reducedMotion) return; // keep the static poster for reduced motion
      const first = fm.getFrame(0);
      if (!first) return;
      srcWRef.current = first.naturalWidth;
      srcHRef.current = first.naturalHeight;
      drawFrame(0);
      // Fade the poster out and the canvas in (deterministic inline styles).
      if (canvas) canvas.style.opacity = '1';
      if (poster) poster.style.opacity = '0';
    };

    const onScrollFrame = () => {
      const progress = stRef.current
        ? stRef.current.progress
        : lastProgressRef.current;
      lastProgressRef.current = progress;

      if (reducedMotion) return;

      // Deterministic mapping, then clamped. `clamp` guards against NaN.
      const target = progress * (TOTAL_FRAMES - 1);
      targetIndexRef.current = Number.isFinite(target)
        ? Math.max(0, Math.min(TOTAL_FRAMES - 1, target))
        : 0;

      // Snap to an exact frame the instant we reach the end so the final
      // frame always shows even before smoothing converges.
      if (progress >= 1) {
        targetIndexRef.current = TOTAL_FRAMES - 1;
        frameIndexRef.current = TOTAL_FRAMES - 1;
        lastDrawIndexRef.current = -1;
      } else if (progress <= 0) {
        targetIndexRef.current = 0;
        frameIndexRef.current = 0;
        lastDrawIndexRef.current = -1;
      }
    };

    // ---------- scroll timeline ----------
    const st = ScrollTrigger.create({
      trigger: wrapperRef.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate(self) {
        lastProgressRef.current = self.progress;
        onScrollFrame();
      },
      onRefresh(self) {
        lastProgressRef.current = self.progress;
        onScrollFrame();
      },
    });
    stRef.current = st;

    // ---------- Lenis smooth scroll ----------
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    });
    lenisRef.current = lenis;

    // A single rAF loop drives Lenis, GSAP ScrollTrigger, the scroll -> frame
    // interpolation and the canvas draw. Exactly one loop = no frame-fighting.
    const loop = (time) => {
      rafRef.current = requestAnimationFrame(loop);

      lenis.raf(time);
      ScrollTrigger.update();

      // Exponential ease toward the target index (deterministic, no flicker
      // even if a frame hasn't decoded yet — we just keep easing toward it).
      frameIndexRef.current +=
        (targetIndexRef.current - frameIndexRef.current) * SMOOTHING;

      const idx = Math.round(frameIndexRef.current);

      // Only repaint when the displayed frame actually changes (zero gaps,
      // no redundant fills, saves battery on static frames).
      if (idx !== lastDrawIndexRef.current) {
        lastDrawIndexRef.current = idx;
        drawFrame(idx);
      }

      // Eagerly preload a window of frames around the current target.
      fm.loadWindow(Math.round(targetIndexRef.current), PRELOAD_WINDOW);
    };
    rafRef.current = requestAnimationFrame(loop);

    // ---------- progressive loading ----------
    fm.loadFirst(); // paint the first frame ASAP (into the poster + canvas)
    fm.onFirstReady(activateCanvas);

    // Preload the rest in the background (after first paint), windowed.
    fm.loadWindow(Math.round(targetIndexRef.current), 6);
    fm.queueRemaining();

    // Safety net: if the poster somehow failed, still try to activate the
    // canvas as soon as frame 0 is available, and keep the page black.
    const posterCheck = window.setTimeout(() => {
      if (fm.isReady(0)) activateCanvas();
    }, 1500);

    // ---------- resize / orientation handling ----------
    const onResize = () => {
      resizeCanvas();
      drawFrame(lastDrawIndexRef.current >= 0 ? lastDrawIndexRef.current : 0);
    };
    window.addEventListener('resize', onResize);

    const ro = new ResizeObserver(() => onResize());
    if (stickyRef.current) ro.observe(stickyRef.current);
    resizeObserverRef.current = ro;

    // Kick the vignette into place on mount (fade-in via CSS).
    requestAnimationFrame(() => {
      if (vignetteRef.current) vignetteRef.current.style.opacity = '1';
    });

    // ---------- cleanup ----------
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (posterCheck) window.clearTimeout(posterCheck);
      if (lenisRef.current) lenisRef.current.destroy();
      window.removeEventListener('resize', onResize);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (stRef.current) stRef.current.kill();
      fm.dispose();
      ctxRef.current = null;
    };
  }, []);

  // First-frame URL for the always-visible poster.
  const posterURL = `${
    import.meta.env.BASE_URL || '/'
  }frames/${FRAME_FILENAMES[0]}`;

  return (
    <div
      ref={wrapperRef}
      className="spaceship-hero__wrapper"
      style={{ background: '#000' }}
    >
      <div ref={stickyRef} className="spaceship-hero__sticky">
        {/* Real first frame, shown immediately via native image loading.
            Fades out once the interactive canvas takes over. */}
        <img
          ref={posterRef}
          className="spaceship-hero__poster"
          src={posterURL}
          alt=""
          aria-hidden="true"
          draggable="false"
          style={{ opacity: 1, transition: 'opacity 0.9s ease' }}
        />
        <canvas
          ref={canvasRef}
          className="spaceship-hero__canvas"
          aria-hidden="true"
          style={{ opacity: 0, transition: 'opacity 0.9s ease' }}
        />
        <div
          ref={vignetteRef}
          className="spaceship-hero__vignette"
          style={{ opacity: 0, transition: 'opacity 2s ease' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
