/* THE DEMO ENGINE: every scripted demo on the page runs on this - one shared requestAnimationFrame clock,
 * a registry that lets at most two demos play at once, and cues in the markup.
 *
 * HOW A DEMO IS WRITTEN. The component renders its whole demo at its FINAL frame - every line, check and
 * verdict present - and marks each element with the moment it appears: data-cue="<ms>" (and optionally
 * data-cue-out="<ms>" for the moment it leaves, data-fx for how it enters; see cue.ts and motion.css). It
 * calls useTimeline(rootRef, { duration, acts, loop }). That is all. The server HTML is the poster; a
 * reduced-motion visitor gets the poster; with motion allowed the engine takes the root over (data-run) and,
 * frame by frame, adds .cue-on to every cue whose time has passed - by classList, so playback costs no React
 * render - and sets data-act="<n>" on the root for act-level states. React hears only about act changes and
 * play/pause/end, which is what tabs and the Pause button need.
 *
 * React and the engine share the cue elements' class attribute. If a re-render rewrites one (a className
 * that depends on state), a MutationObserver puts the engine's classes back before the browser paints, and
 * cues mounted later are picked up the same way - a section never has to tell the engine it re-rendered.
 *
 * WHEN IT PLAYS. Only while the root is at least `threshold` in view (35% by default), the tab is visible,
 * nothing inside is hovered or focused (controls marked data-tl-control excepted - pressing Play must not
 * pause it), the visitor has not pressed Pause, and the registry gives it a slot: a demo that starts playing
 * takes a slot from the one that started earliest. A demo that was interrupted resumes from the START of its
 * current act, so nobody comes back to the middle of a sentence.
 *
 * AT HYDRATION, so nothing visible flashes: a demo below the fold silently resets to its first frame; a
 * looping demo already on screen keeps its final frame through its rest and then starts the next cycle; a
 * one-shot demo already on screen does not replay - it ends, and the component shows Replay.
 *
 * MANUAL NAVIGATION (goToAct - a tab, a step) jumps to that act, plays it once and holds; autoplay is off
 * from then on until the visitor presses Play.
 */
import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { useIsoLayoutEffect } from './hooks';
import { motionAllowed, subscribeMotion } from './state';

export interface TimelineOptions {
  /** One cycle in ms, including the rest after the last cue. */
  duration: number;
  /** Start time of each act, ascending, first one 0. Default [0]: one act. */
  acts?: number[];
  /** Start again from the first frame after `duration`. Default false: play once and end. */
  loop?: boolean;
  /** Fraction of the root that must be visible to play. Default 0.35 (the deck uses 0.4). */
  threshold?: number;
  /** Pause while the pointer is over, or focus is inside, this element (default: the root). */
  pauseOn?: RefObject<HTMLElement | null>;
  /** Pause on hover and on focus inside. Default true. */
  pauseOnHover?: boolean;
  /** The act shown with reduced motion (the poster). Default the last act. */
  posterAct?: number;
  /** Start playing by itself when it comes into view. Default true. */
  autoplay?: boolean;
  /** A one-shot demo plays again after the root has fully left the viewport and come back. */
  replayOnReenter?: boolean;
  /** Playback speed; 2 plays every cue twice as fast. Default 1. */
  rate?: number;
}

export interface Timeline {
  /** False on the server and in the first client render; true once the engine owns the root. */
  enhanced: boolean;
  /** Whether motion is allowed (false on the server, with reduced motion, and with ?still). */
  motion: boolean;
  /** The current act - for aria-selected on tabs. With reduced motion, the act on show. */
  act: number;
  /** The clock is advancing right now. */
  playing: boolean;
  /** The visitor has paused it, or autoplay was stopped by manual navigation: aria-pressed of PlayToggle. */
  paused: boolean;
  /** A one-shot demo reached its end: show Replay. */
  ended: boolean;
  /** Pause / Play. Play after manual navigation turns autoplay back on. */
  toggle(): void;
  /** Back to the first frame, playing. */
  replay(): void;
  /** Manual navigation: jump to act n, play it once and hold. Stops autoplay. Instant with reduced motion. */
  goToAct(n: number): void;
  /** Called with the clock's time on every frame and every jump: for the few things a class cannot say. */
  subscribe(fn: (t: number) => void): () => void;
  /** The clock's current time in ms. */
  time(): number;
}

const MAX_PLAYING = 2;
const CONTROL = '[data-tl-control]';

interface Cue {
  el: HTMLElement;
  at: number;
  out: number | null;
}

interface Snapshot {
  motion: boolean;
  act: number;
  playing: boolean;
  paused: boolean;
  ended: boolean;
}

/* ── The shared clock: one rAF loop for every playing demo, stopped when none is. ── */
const ticking = new Set<Demo>();
let raf = 0;
let last = 0;

function frame(now: number) {
  /* A long gap (a backgrounded tab, a debugger) is one frame, not a jump through the script. */
  const dt = last ? Math.min(now - last, 64) : 16;
  last = now;
  for (const d of [...ticking]) d.tick(dt);
  if (ticking.size) raf = requestAnimationFrame(frame);
  else {
    raf = 0;
    last = 0;
  }
}

function startClock() {
  if (raf) return;
  last = 0;
  raf = requestAnimationFrame(frame);
}

/* ── The registry: at most MAX_PLAYING demos play; the ones that most recently started wanting win. ── */
const demos = new Set<Demo>();
let asked = 0;

function reschedule() {
  for (const d of demos) d.refreshWant();
  const wanting = [...demos].filter((d) => d.wanted).sort((a, b) => b.since - a.since);
  const allowed = new Set(wanting.slice(0, MAX_PLAYING));
  for (const d of demos) d.setSlot(allowed.has(d));
}

let docVisible = typeof document === 'undefined' ? true : document.visibilityState !== 'hidden';
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    docVisible = document.visibilityState !== 'hidden';
    reschedule();
  });
}

class Demo {
  el: HTMLElement;
  opts: TimelineOptions;
  emit: (s: Snapshot) => void;
  cues: Cue[] = [];
  byEl = new Map<Element, Cue>();
  listeners = new Set<(t: number) => void>();
  t = 0;
  act = 0;
  motion = false;
  inView = false;
  hovered = false;
  focused = false;
  userPaused = false;
  autoplay = true;
  segmentEnd: number | null = null;
  holding = false;
  ended = false;
  slot = false;
  running = false;
  since = 0;
  wanted = false;
  restartAct = false;
  seekTimer = 0;

  constructor(el: HTMLElement, opts: TimelineOptions, emit: (s: Snapshot) => void) {
    this.el = el;
    this.opts = opts;
    this.emit = emit;
    this.autoplay = opts.autoplay !== false;
  }

  get acts(): number[] {
    const a = this.opts.acts;
    return a && a.length ? a : [0];
  }

  actAt(t: number): number {
    const acts = this.acts;
    let i = 0;
    while (i + 1 < acts.length && t >= acts[i + 1]!) i++;
    return i;
  }

  /** The cues that belong to this root (a nested demo's cues are its own). */
  collect() {
    const found: Cue[] = [];
    const byEl = new Map<Element, Cue>();
    for (const el of this.el.querySelectorAll<HTMLElement>('[data-cue]')) {
      if (el.closest('[data-timeline]') !== this.el) continue;
      const at = Number(el.dataset.cue) || 0;
      const outRaw = el.dataset.cueOut;
      const c = { el, at, out: outRaw === undefined || outRaw === '' ? null : Number(outRaw) };
      found.push(c);
      byEl.set(el, c);
    }
    this.cues = found;
    this.byEl = byEl;
  }

  /** The last moment anything changes: where a looping demo's final frame is complete. */
  finalTime(): number {
    let t = this.acts[this.acts.length - 1]!;
    for (const c of this.cues) t = Math.max(t, c.at, c.out ?? 0);
    return Math.min(t, this.opts.duration - 1);
  }

  /** Put one cue's classes where the clock says they are. Returns nothing; touches the DOM only on change. */
  place(c: Cue, t: number) {
    const on = t >= c.at;
    const list = c.el.classList;
    if (on !== list.contains('cue-on')) {
      /* How long ago the cue "really" started - a TypeText or a CSS animation keyed to the cue reads it
         as a negative delay, so a jump past it lands on its end state instead of replaying it. */
      if (on) c.el.style.setProperty('--cue-age', Math.max(0, Math.round(t - c.at)) + 'ms');
      list.toggle('cue-on', on);
    }
    const out = c.out !== null && t >= c.out;
    if (out !== list.contains('cue-out')) list.toggle('cue-out', out);
  }

  apply(t: number, seek = false) {
    this.t = t;
    if (seek) {
      /* A jump must not animate: data-seek switches the cue transitions off for two frames. */
      this.el.setAttribute('data-seek', '');
      cancelAnimationFrame(this.seekTimer);
      this.seekTimer = requestAnimationFrame(() => {
        this.seekTimer = requestAnimationFrame(() => this.el.removeAttribute('data-seek'));
      });
    }
    /* With reduced motion every cue is shown (the poster): the engine owns no class then. */
    if (this.motion) for (const c of this.cues) this.place(c, t);
    /* With reduced motion the act is whatever was chosen, not a function of the (parked) clock. */
    const act = this.motion ? this.actAt(t) : this.act;
    if (act !== this.act || this.el.dataset.act !== String(act)) {
      this.act = act;
      this.el.dataset.act = String(act);
      this.publish();
    }
    for (const l of this.listeners) l(t);
  }

  /** React (or a late mount) changed the markup: re-read the cues it touched and put their classes back. */
  repair(records: MutationRecord[]) {
    if (!this.motion) return;
    let recollect = false;
    for (const r of records) {
      if (r.type === 'childList') recollect = true;
      else {
        const c = this.byEl.get(r.target as Element);
        if (c) this.place(c, this.t);
        else if ((r.target as Element).hasAttribute?.('data-cue')) recollect = true;
      }
    }
    if (recollect) {
      this.collect();
      for (const c of this.cues) this.place(c, this.t);
    }
  }

  publish() {
    this.emit({
      motion: this.motion,
      act: this.act,
      playing: this.running,
      paused: this.motion ? this.userPaused || !this.autoplay : false,
      ended: this.ended,
    });
  }

  wants(): boolean {
    if (!this.motion || !this.inView || !docVisible || this.hovered || this.focused || this.userPaused) return false;
    return this.autoplay ? !this.ended : this.segmentEnd !== null;
  }

  refreshWant() {
    const w = this.wants();
    if (w && !this.wanted) this.since = ++asked;
    this.wanted = w;
  }

  setSlot(slot: boolean) {
    this.slot = slot;
    const run = this.wanted && slot;
    if (run === this.running) return;
    this.running = run;
    if (run) {
      if (this.restartAct) {
        this.restartAct = false;
        this.apply(this.acts[this.act]!, true);
      }
      this.el.removeAttribute('data-paused');
      ticking.add(this);
      startClock();
    } else {
      ticking.delete(this);
      this.el.setAttribute('data-paused', '');
      /* Interrupted mid-act (scrolled away, hovered, paused, out-ranked): resume from the act's start. */
      if (!this.ended && !this.holding && this.motion) this.restartAct = true;
    }
    this.publish();
  }

  tick(dt: number) {
    let t = this.t + dt * (this.opts.rate ?? 1);
    const { duration, loop } = this.opts;
    if (this.segmentEnd !== null && t >= this.segmentEnd) {
      /* Manual act: hold its last frame. */
      this.apply(this.segmentEnd - 1);
      this.segmentEnd = null;
      this.holding = true;
      reschedule();
      return;
    }
    if (t >= duration) {
      if (loop && this.autoplay) {
        t -= duration;
        this.apply(t);
        return;
      }
      this.apply(duration);
      this.ended = true;
      reschedule();
      this.publish();
      return;
    }
    this.apply(t);
  }

  /* ── what the hook's controls call ── */

  toggle() {
    if (!this.motion) return;
    if (this.ended) return this.replay();
    if (this.autoplay && !this.userPaused) {
      this.userPaused = true;
    } else {
      this.userPaused = false;
      if (!this.autoplay) {
        this.autoplay = true;
        this.segmentEnd = null;
        if (this.holding) {
          /* Held after a chosen act: go on into the next one rather than replaying it. */
          this.holding = false;
          this.restartAct = false;
          const next = this.t + 1;
          this.apply(next >= this.opts.duration ? 0 : next, true);
        }
      }
    }
    reschedule();
    this.publish();
  }

  replay() {
    this.ended = false;
    this.holding = false;
    this.autoplay = true;
    this.userPaused = false;
    this.segmentEnd = null;
    this.restartAct = false;
    if (this.motion) this.apply(0, true);
    reschedule();
    this.publish();
  }

  goToAct(n: number) {
    const acts = this.acts;
    const i = Math.max(0, Math.min(acts.length - 1, n));
    this.autoplay = false;
    this.userPaused = false;
    this.ended = false;
    if (!this.motion) {
      this.act = i;
      this.el.dataset.act = String(i);
      this.publish();
      return;
    }
    this.holding = false;
    this.restartAct = false;
    this.apply(acts[i]!, true);
    this.segmentEnd = acts[i + 1] ?? this.opts.duration;
    reschedule();
    this.publish();
  }

  /** Motion allowed or not: take the root over, or hand it back as the poster. */
  setMotion(motion: boolean) {
    this.motion = motion;
    const { duration, loop } = this.opts;
    if (!motion) {
      ticking.delete(this);
      this.running = false;
      this.el.removeAttribute('data-run');
      this.el.removeAttribute('data-paused');
      for (const c of this.cues) c.el.classList.remove('cue-on', 'cue-out');
      this.act = this.opts.posterAct ?? this.acts.length - 1;
      this.apply(duration);
      reschedule();
      this.publish();
      return;
    }
    this.el.setAttribute('data-run', '');
    this.el.setAttribute('data-paused', '');
    const r = this.el.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
    if (onScreen) {
      /* Painted already: keep the picture the visitor is looking at. */
      if (loop) this.apply(this.finalTime(), true);
      else {
        this.apply(duration, true);
        this.ended = true;
      }
    } else {
      this.apply(0, true);
    }
    reschedule();
    this.publish();
  }

  setInView(inView: boolean, gone: boolean) {
    if (gone && this.opts.replayOnReenter && this.ended && this.motion) {
      /* Fully off screen: reset silently, so it plays again on the way back. */
      this.ended = false;
      this.autoplay = true;
      this.holding = false;
      this.restartAct = false;
      this.apply(0, true);
      this.publish();
    }
    if (inView === this.inView) return;
    this.inView = inView;
    reschedule();
  }

  setHover(hovered: boolean) {
    if (hovered === this.hovered) return;
    this.hovered = hovered;
    reschedule();
  }

  setFocus(focused: boolean) {
    if (focused === this.focused) return;
    this.focused = focused;
    reschedule();
  }

  destroy() {
    ticking.delete(this);
    demos.delete(this);
    cancelAnimationFrame(this.seekTimer);
    reschedule();
  }
}

const IDLE: Snapshot = { motion: false, act: 0, playing: false, paused: false, ended: false };

/** Lets a part of a demo (the bee cursor, a clock) follow its timeline without props. */
export const TimelineContext = createContext<Timeline | null>(null);

/** Run fn(t) on every frame and jump of the surrounding demo's timeline (or of the one passed). */
export function useTimelineFrame(fn: (t: number) => void, timeline?: Timeline | null) {
  const ctx = useContext(TimelineContext);
  const tl = timeline ?? ctx;
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => (tl ? tl.subscribe((t) => latest.current(t)) : undefined), [tl]);
}

/**
 * Take a demo root over. Render the root with ref={rootRef}; render every cue in its final state with
 * data-cue / data-cue-out / data-fx (cue() writes them); do NOT render data-act, data-run, data-paused or
 * data-timeline yourself.
 */
export function useTimeline(rootRef: RefObject<HTMLElement | null>, options: TimelineOptions): Timeline {
  const [snap, setSnap] = useState<Snapshot>(() => ({ ...IDLE, act: options.posterAct ?? Math.max(0, (options.acts?.length ?? 1) - 1) }));
  const [enhanced, setEnhanced] = useState(false);
  const demo = useRef<Demo | null>(null);
  const opts = useRef(options);
  opts.current = options;
  if (demo.current) demo.current.opts = options;

  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    el.setAttribute('data-timeline', '');
    const d = new Demo(el, opts.current, (s) =>
      setSnap((p) =>
        p.motion === s.motion && p.act === s.act && p.playing === s.playing && p.paused === s.paused && p.ended === s.ended ? p : s,
      ),
    );
    demo.current = d;
    demos.add(d);
    d.collect();
    d.setMotion(motionAllowed());
    setEnhanced(true);
    /* A live change of the system setting: take the root over, or hand it back as the poster. */
    const unsubscribe = subscribeMotion(() => d.setMotion(motionAllowed()));

    const watch = new MutationObserver((records) => d.repair(records));
    watch.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

    const threshold = opts.current.threshold ?? 0.35;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        const rootH = e.rootBounds?.height ?? window.innerHeight;
        /* A root taller than the screen can show `threshold` of counts as in view once it fills half of it. */
        const enough = e.isIntersecting && (e.intersectionRatio >= threshold || e.intersectionRect.height >= rootH * 0.5);
        d.setInView(enough, !e.isIntersecting);
      },
      { threshold: [0, 0.1, threshold, 0.5, 0.75, 1] },
    );
    io.observe(el);

    const target = (opts.current.pauseOn?.current ?? el) as HTMLElement;
    const hoverable = opts.current.pauseOnHover !== false;
    const over = (e: PointerEvent) => {
      if (!hoverable || e.pointerType !== 'mouse') return;
      d.setHover(!(e.target as Element).closest(CONTROL));
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') d.setHover(false);
    };
    const focusIn = (e: FocusEvent) => {
      if (!hoverable) return;
      d.setFocus(!(e.target as Element).closest(CONTROL));
    };
    const focusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !target.contains(next)) d.setFocus(false);
    };
    target.addEventListener('pointerover', over);
    target.addEventListener('pointerleave', leave);
    target.addEventListener('focusin', focusIn);
    target.addEventListener('focusout', focusOut);
    return () => {
      unsubscribe();
      watch.disconnect();
      io.disconnect();
      target.removeEventListener('pointerover', over);
      target.removeEventListener('pointerleave', leave);
      target.removeEventListener('focusin', focusIn);
      target.removeEventListener('focusout', focusOut);
      d.destroy();
      demo.current = null;
      el.removeAttribute('data-run');
      el.removeAttribute('data-paused');
      el.removeAttribute('data-timeline');
    };
  }, [rootRef]);

  const api = useRef<Timeline | null>(null);
  const controls = {
    toggle: () => demo.current?.toggle(),
    replay: () => demo.current?.replay(),
    goToAct: (n: number) => demo.current?.goToAct(n),
    subscribe: (fn: (t: number) => void) => {
      const d = demo.current;
      if (!d) return () => {};
      d.listeners.add(fn);
      fn(d.t);
      return () => {
        d.listeners.delete(fn);
      };
    },
    time: () => demo.current?.t ?? 0,
  };
  const next: Timeline = { enhanced, ...snap, ...controls };
  /* A stable object while nothing it reports has changed, so it can be a context value without
     re-rendering every subscriber on each render of the host. */
  const prev = api.current;
  if (
    !prev ||
    prev.enhanced !== next.enhanced ||
    prev.motion !== next.motion ||
    prev.act !== next.act ||
    prev.playing !== next.playing ||
    prev.paused !== next.paused ||
    prev.ended !== next.ended
  ) {
    api.current = next;
  }
  return api.current!;
}
