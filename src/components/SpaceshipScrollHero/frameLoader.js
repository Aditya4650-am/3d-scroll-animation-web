// frameLoader.js
// Smart frame preloader + manager for the spaceship frame sequence.
//
// Responsibilities:
//   - deterministic natural numeric sorting of frame sources
//   - immediate load of the first frame, then progressive background loading
//   - prioritisation of frames near the current scroll index
//   - graceful error handling (a failed frame never crashes the page)
//   - a single decoded Image object per frame (no duplicate image objects)

/**
 * Natural numeric sort. `frame_2` sorts before `frame_10`.
 * Falls back to plain string comparison if a value is not a string.
 */
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export class FrameManager {
  /**
   * @param {string[]} sources array of image URLs.
   */
  constructor(sources) {
    // Defensive: never trust external ordering — always natural-sort.
    this.urls = sources.slice().sort(naturalCompare);
    this.total = this.urls.length;
    this.images = new Array(this.total).fill(null);
    // state: 'idle' | 'loading' | 'ready' | 'error'
    this.state = new Array(this.total).fill('idle');
    this._readyCount = 0;
    this._firstReady = false;
    this._onFirstReady = null;
    this._queue = [];
    this._processingQueue = false;
  }

  /** @param {(index:number)=>void} cb called once the very first frame decodes. */
  onFirstReady(cb) {
    if (this._firstReady) cb(0);
    else this._onFirstReady = cb;
  }

  isReady(index) {
    const img = this.images[index];
    return (
      this.state[index] === 'ready' && !!img && img.complete && img.naturalWidth > 0
    );
  }

  hasLoaded(index) {
    return this.state[index] === 'ready' || this.state[index] === 'error';
  }

  /** The decoded Image for a frame, or null if not loaded/failed. */
  getFrame(index) {
    return this.isReady(index) ? this.images[index] : null;
  }

  /** Kick off loading for a single index (no-op if already loaded/loading). */
  load(index) {
    if (index < 0 || index >= this.total) return;
    if (this.state[index] !== 'idle') return;
    this.state[index] = 'loading';

    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      if (this.state[index] !== 'loading') return;
      this.images[index] = img;
      this.state[index] = 'ready';
      this._readyCount += 1;
      if (!this._firstReady) {
        this._firstReady = true;
        if (this._onFirstReady) this._onFirstReady(index);
      }
      this._processQueue();
    };

    img.onerror = () => {
      // Graceful: mark failed and move on — never crash the animation loop.
      if (this.state[index] !== 'loading') return;
      this.state[index] = 'error';
      this._processQueue();
    };

    img.src = this.urls[index];
  }

  /** Load the very first frame immediately (the fastest-possible first paint). */
  loadFirst() {
    this.load(0);
  }

  /** Load a window of frames around `center` (prioritises frames near scroll). */
  loadWindow(center, radius) {
    const lo = Math.max(0, center - radius);
    const hi = Math.min(this.total - 1, center + radius);
    for (let i = lo; i <= hi; i += 1) this.load(i);
  }

  /** Queue all remaining frames for sequential background loading. */
  queueRemaining() {
    for (let i = 0; i < this.total; i += 1) {
      if (this.state[i] === 'idle') this._queue.push(i);
    }
    this._processQueue();
  }

  _processQueue() {
    if (this._processingQueue) return;
    if (this._queue.length === 0) return;

    this._processingQueue = true;
    try {
      const next = this._queue.shift();
      if (next !== undefined) this.load(next);
    } finally {
      this._processingQueue = false;
    }
  }

  /**
   * Nearest frame (within `radius`) that is decoded and ready, used as a
   * fallback when a specific frame is missing so we never show a blank canvas.
   */
  nearestReady(index, radius = 4) {
    for (let r = 0; r <= radius; r += 1) {
      const a = index - r;
      const b = index + r;
      if (a >= 0 && this.isReady(a)) return a;
      if (b < this.total && this.isReady(b)) return b;
    }
    // Fall back to a full scan across the whole sequence.
    for (let i = 0; i < this.total; i += 1) {
      if (this.isReady(i)) return i;
    }
    return null;
  }

  /** Release references to decoded images to free memory (on unmount). */
  dispose() {
    for (let i = 0; i < this.total; i += 1) {
      const img = this.images[i];
      if (img) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      }
      this.images[i] = null;
      this.state[i] = 'idle';
    }
    this._queue.length = 0;
    this._onFirstReady = null;
  }
}
