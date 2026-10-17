/* THE DECK - eight run cards in one continuous object: the active card in the middle, its neighbours
 * dimmed beside it, the rest parked out of sight. It is the section's one demo, on the page's one engine.
 *
 * THE TIMELINE IS THE DWELL. One looping useTimeline (6.5s, the 40% threshold the spec gives the deck) owns
 * the deck root. Act 0 is the active card's mini-run, act 1 its rest. When the clock wraps, the next card
 * slides in and the clock's fresh start is that card's run - so autoplay, the pause on hover and focus,
 * the off-screen pause, the two-demos-at-once registry and "resume from the start of the act" all come
 * from the engine; this file only says which card is active. Every card carries its cues all the time;
 * UseCases.css shows them finished on every card but the active one.
 *
 * MANUAL NAVIGATION (arrows, dots, a click on a neighbour, a swipe, the keyboard, a filter) moves the deck,
 * replays the new card's run once and holds: autoplay stays off until Play. Only these moves are announced.
 * The controls are data-tl-control, so the click that moves the deck does not also pause the replay it
 * starts (a pressed button keeps focus); keyboard focus arriving in the carousel stops the rotation instead,
 * as the WAI carousel pattern asks. A paused deck that has played once shows its active card finished
 * (UseCases.css), so hovering a card to read it never freezes it half-written.
 *
 * WITHOUT A SCRIPT the server's markup is a horizontal scroll-snap row of all eight finished cards; the
 * deck, its filters and its controls are switched on by data-enhanced after hydration.
 */
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { IconButton } from '@insightis/ui/IconButton';
import { revealGroup, revealItem, useIsoLayoutEffect, useTimeline, type Timeline } from '../../motion';
import { PlayToggle } from '../kit';
import { CASES, FILTERS, subsetOf, type Filter, type UseCase } from './cases';
import { CaseCard, RUN_END } from './CaseCard';
import { moveDeck, restingOffsets, ringOffset } from './ring';

/** Each card's time in the middle while autoplay runs. */
const DWELL = 6500;
/** A release past this share of the card's width, or faster than this, goes to the neighbour. */
const SWIPE_SHARE = 0.18;
const SWIPE_SPEED = 0.4; // px per ms
/** Horizontal intent before a drag takes over, and the most a tap may wander. */
const DRAG_START = 8;
const TAP_SLOP = 6;

interface DeckState {
  filter: Filter;
  active: string;
  offsets: Record<string, number>;
  pre: Record<string, number>;
  seq: number;
  /** Who moved it: the first render, autoplay, or a person (which replays the card once and holds). */
  why: 'init' | 'auto' | 'user';
}

const pad = (n: number) => String(n).padStart(2, '0');

const INITIAL: DeckState = {
  filter: 'all',
  active: CASES[0]!.id,
  offsets: restingOffsets(
    CASES.map((c) => c.id),
    0,
  ),
  pre: {},
  seq: 0,
  why: 'init',
};

function shown(s: DeckState) {
  const list = subsetOf(s.filter);
  return { list, ids: list.map((c) => c.id), at: Math.max(0, list.findIndex((c) => c.id === s.active)) };
}

/** Move by `delta` cards within the shown subset (wrapping). */
function step(s: DeckState, delta: number, why: DeckState['why']): DeckState {
  const { ids, at } = shown(s);
  const n = ids.length;
  if (!delta || n < 2) return s;
  const target = (((at + delta) % n) + n) % n;
  const { offsets, pre } = moveDeck(ids, target, s.offsets, delta);
  return { ...s, active: ids[target]!, offsets: { ...s.offsets, ...offsets }, pre, seq: s.seq + 1, why };
}

/** Go to card `target` of the subset by the shorter way round. */
function goTo(s: DeckState, target: number, why: DeckState['why']): DeckState {
  const { ids, at } = shown(s);
  return step(s, ringOffset(target - at, ids.length), why);
}

function filterTo(s: DeckState, filter: Filter): DeckState {
  if (filter === s.filter) return s;
  const before = new Set(shown(s).ids);
  const ids = subsetOf(filter).map((c) => c.id);
  const prev: Record<string, number | undefined> = {};
  for (const id of ids) prev[id] = before.has(id) ? s.offsets[id] : undefined;
  const { offsets, pre } = moveDeck(ids, 0, prev, 0);
  return { ...s, filter, active: ids[0]!, offsets: { ...s.offsets, ...offsets }, pre, seq: s.seq + 1, why: 'user' };
}

interface Drag {
  id: number;
  x0: number;
  y0: number;
  x: number;
  engaged: boolean;
  dead: boolean;
  width: number;
  samples: { x: number; t: number }[];
}

export function Deck() {
  const [s, setS] = useState<DeckState>(INITIAL);
  const live = useRef(s);
  live.current = s;
  const [manual, setManual] = useState(false);
  const manualRef = useRef(false);
  manualRef.current = manual;
  const [announce, setAnnounce] = useState('');
  /* Set the first time the clock runs. Before that a deck parked below the fold sits at frame 0, and its
     active card must stay unwritten until its run starts; after it, any pause shows the card finished. */
  const [played, setPlayed] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLElement>(null);
  const cards = useRef<Record<string, HTMLDivElement | null>>({});
  const radios = useRef<Record<string, HTMLButtonElement | null>>({});

  const tl = useTimeline(root, { duration: DWELL, acts: [0, RUN_END], loop: true, threshold: 0.4, posterAct: 1 });
  const on = tl.enhanced;
  const { list, at } = shown(s);
  const n = list.length;

  /* The honey fill under the active dot is the dwell's clock while autoplay runs; it is full when a person
     has taken over (or motion is off) - there is no countdown then. */
  const paintFill = (t: number) => {
    const el = fill.current;
    if (!el) return;
    const share = manualRef.current || !tl.motion ? 1 : Math.min(1, Math.max(0, t / DWELL));
    el.style.transform = `scaleX(${share})`;
  };

  /* Autoplay: the clock wrapped (not a jump - a jump carries data-seek), so the next card comes in. flushSync
     commits it in this same frame: the wrap has just hidden the active card's lines, and the new card must
     be the active one before anything paints. */
  useEffect(() => {
    let last = tl.time();
    return tl.subscribe((t) => {
      const el = root.current;
      if (t + 1000 < last && el && !el.hasAttribute('data-seek')) {
        flushSync(() => setS((cur) => step(cur, 1, 'auto')));
      }
      last = t;
      paintFill(t);
    });
    /* Re-subscribed whenever the engine reports a new state; paintFill reads refs only. */
  }, [tl]);

  useEffect(() => paintFill(tl.time()), [manual, on, tl.motion]);

  useEffect(() => {
    if (tl.playing) setPlayed(true);
  }, [tl.playing]);

  /* After a move: pre-place the cards that cross the ring's seam (ring.ts), then let them glide; a person's
     move replays the new card's run once and holds. */
  useIsoLayoutEffect(() => {
    const ids = Object.keys(s.pre);
    if (ids.length && track.current) {
      for (const id of ids) {
        const el = cards.current[id];
        if (!el) continue;
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.setProperty('--o', String(s.pre[id]));
      }
      void track.current.offsetWidth;
      for (const id of ids) {
        const el = cards.current[id];
        if (!el) continue;
        el.style.removeProperty('transition');
        el.style.removeProperty('opacity');
        el.style.setProperty('--o', String(s.offsets[id]));
      }
    }
    if (s.why === 'user') tl.goToAct(0);
    /* Once per move; tl's methods always reach the live engine. */
  }, [s.seq]);

  const userMove = (next: DeckState) => {
    if (next === live.current) return;
    live.current = next;
    setS(next);
    setManual(true);
    const v = shown(next);
    setAnnounce(`Use case ${v.at + 1} of ${v.list.length}: ${v.list[v.at]!.title}`);
  };
  const userStep = (delta: number) => userMove(step(live.current, delta, 'user'));
  const userGoTo = (i: number) => userMove(goTo(live.current, i, 'user'));
  const userFilter = (f: Filter) => userMove(filterTo(live.current, f));

  /* Play after a person took over hands the deck back to autoplay; the dwell's fill comes back with it. */
  const toggleTl: Timeline = {
    ...tl,
    toggle: () => {
      setManual(false);
      manualRef.current = false;
      tl.toggle();
    },
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('[role="radiogroup"]')) return;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => userStep(-1),
      ArrowRight: () => userStep(1),
      Home: () => userGoTo(0),
      End: () => userGoTo(n - 1),
    };
    const fn = keys[e.key];
    if (!fn || !on) return;
    e.preventDefault();
    fn();
  };

  /* Keyboard focus entering the carousel stops the rotation (aria-pressed shows it; Play resumes). The
     Pause button itself is exempt, so pressing it toggles once. A mouse click focuses a button too, but not
     :focus-visible - and a click on a control is a manual move, which stops autoplay anyway. */
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as Element;
    if (manualRef.current || !tl.motion || tl.paused || el.closest('.uc-ctl--pause')) return;
    if (el.matches(':focus-visible')) tl.toggle();
  };

  const onFilterKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = FILTERS.findIndex((f) => f.id === live.current.filter);
    const move: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: FILTERS.length - 1 };
    if (!(e.key in move)) return;
    e.preventDefault();
    const f = FILTERS[(move[e.key]! + FILTERS.length) % FILTERS.length]!;
    userFilter(f.id);
    radios.current[f.id]?.focus();
  };

  /* ── Drag: the deck follows the finger 1:1 (transform only, through --uc-drag) and the neighbour it moves
     toward brightens in proportion. touch-action: pan-y leaves vertical scrolling to the page; a drag takes
     over only after 8px of clearly horizontal movement. With reduced motion nothing travels: the release
     alone decides. ── */
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const swallowClick = useRef(false);

  const paintDrag = (dx: number, width: number) => {
    const el = track.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const p = Math.min(1, Math.abs(dx) / (width || 1));
      el.style.setProperty('--uc-drag', `${dx}px`);
      el.style.setProperty('--uc-pr', String(dx < 0 ? p : 0));
      el.style.setProperty('--uc-pl', String(dx > 0 ? p : 0));
    });
  };

  const endDrag = (el: HTMLDivElement) => {
    cancelAnimationFrame(frame.current);
    el.removeAttribute('data-drag');
    el.style.removeProperty('--uc-drag');
    el.style.removeProperty('--uc-pr');
    el.style.removeProperty('--uc-pl');
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!on || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const card = cards.current[live.current.active];
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, engaged: false, dead: false, width: card?.offsetWidth || 300, samples: [{ x: e.clientX, t: e.timeStamp }] };
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || d.dead) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.engaged) {
      if (Math.abs(dy) > DRAG_START && Math.abs(dy) >= Math.abs(dx)) {
        d.dead = true;
        return;
      }
      if (Math.abs(dx) <= DRAG_START || Math.abs(dx) < Math.abs(dy)) return;
      d.engaged = true;
      /* The pointer may already be gone (lifted in the same frame); the drag still works without capture. */
      try {
        view.current?.setPointerCapture(e.pointerId);
      } catch {
        /* nothing to capture */
      }
      track.current?.setAttribute('data-drag', '');
      window.getSelection()?.removeAllRanges();
    }
    d.x = e.clientX;
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0]!.t > 100) d.samples.shift();
    if (tl.motion) paintDrag(dx, d.width);
  };

  const onUp = (e: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    /* A press that wandered more than a tap allows (but never became a drag) selects nothing either. */
    const wandered = Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > TAP_SLOP;
    if (d.engaged || wandered) {
      swallowClick.current = true;
      requestAnimationFrame(() => {
        swallowClick.current = false;
      });
    }
    if (!d.engaged) return;
    const el = track.current;
    if (!el) return;
    const dx = d.x - d.x0;
    const first = d.samples[0]!;
    const lastS = d.samples[d.samples.length - 1]!;
    const speed = lastS.t > first.t ? (lastS.x - first.x) / (lastS.t - first.t) : 0;
    const go = !cancelled && (Math.abs(dx) > SWIPE_SHARE * d.width || (Math.abs(speed) > SWIPE_SPEED && Math.sign(speed) === Math.sign(dx)));
    endDrag(el);
    if (go) userStep(dx < 0 ? 1 : -1);
    else {
      /* Not far enough: spring back, a little quicker and on the arrival curve. */
      el.setAttribute('data-settle', '');
      window.setTimeout(() => el.removeAttribute('data-settle'), 380);
    }
  };

  /* A click on a peeking neighbour selects it (the neighbours themselves are inert; these two strips sit
     over them, hidden from assistive tech - the arrows are the accessible way). */
  const tapSide = (delta: number) => () => {
    if (swallowClick.current) return;
    userStep(delta);
  };

  const filterCounts: Record<Filter, number> = { all: CASES.length, qa: subsetOf('qa').length, it: subsetOf('it').length };

  return (
    <div
      ref={root}
      className="uc"
      role="region"
      aria-roledescription="carousel"
      aria-label="Use cases"
      data-enhanced={on ? '' : undefined}
      data-played={played ? '' : undefined}
      onKeyDown={onKey}
      onFocus={onFocus}
      {...revealGroup()}
    >
      {on && (
        <div role="radiogroup" aria-label="Filter use cases" className="uc-filters" data-tl-control="" onKeyDown={onFilterKey} {...revealItem(0)}>
          {FILTERS.map((f) => {
            const checked = s.filter === f.id;
            return (
              <Button
                key={f.id}
                ref={(el: HTMLButtonElement | null) => {
                  radios.current[f.id] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                variant="tertiary"
                size="lg"
                rounded="full"
                className="uc-filter"
                onClick={() => userFilter(f.id)}
              >
                <i className="uc-filter-on" aria-hidden="true" />
                {f.label}
                <i className="uc-filter-dot" aria-hidden="true">
                  ·
                </i>
                <span className="uc-filter-n">{filterCounts[f.id]}</span>
              </Button>
            );
          })}
        </div>
      )}

      <div
        ref={view}
        className="uc-view"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => onUp(e)}
        onPointerCancel={(e) => onUp(e, true)}
      >
        <div ref={track} className="uc-track">
          {CASES.map((c) => {
            const i = list.findIndex((x) => x.id === c.id);
            return (
              <CaseCard
                key={c.id}
                ref={(el: HTMLDivElement | null) => {
                  cards.current[c.id] = el;
                }}
                c={c}
                index={i < 0 ? CASES.indexOf(c) : i}
                total={i < 0 ? CASES.length : n}
                offset={s.offsets[c.id] ?? 0}
                active={c.id === s.active}
                out={i < 0}
                enhanced={on}
              />
            );
          })}
        </div>
        {on && (
          <>
            <span className="uc-hit uc-hit--prev" aria-hidden="true" data-tl-control="" onClick={tapSide(-1)} />
            <span className="uc-hit uc-hit--next" aria-hidden="true" data-tl-control="" onClick={tapSide(1)} />
          </>
        )}
      </div>

      {on && (
        <>
          <span className="uc-ctl uc-ctl--pause" {...revealItem(2, 'fade')}>
            <PlayToggle timeline={toggleTl} label="Pause autoplay" className="uc-btn" />
          </span>
          <span className="uc-ctl uc-ctl--prev" data-tl-control="" {...revealItem(2, 'fade')}>
            <IconButton type="button" variant="secondary" size="xl" rounded="full" className="uc-btn" aria-label="Previous use case" onClick={() => userStep(-1)}>
              <ChevronLeft aria-hidden strokeWidth={2} />
            </IconButton>
          </span>
          <div className="uc-dots" data-tl-control="" {...revealItem(2, 'fade', { '--di': at } as CSSProperties)}>
            {list.map((c: UseCase, i) => (
              <IconButton
                key={c.id}
                type="button"
                variant="tertiary"
                size="sm"
                rounded="full"
                className="uc-dot"
                aria-label={`Go to ${i + 1}: ${c.title}`}
                aria-current={i === at ? 'true' : undefined}
                onClick={() => userGoTo(i)}
              >
                <i className="uc-dot-hex" data-tone={c.tone} aria-hidden="true" />
              </IconButton>
            ))}
            <span className="uc-dots-pill" aria-hidden="true">
              <i ref={fill} />
            </span>
          </div>
          <span className="uc-ctl uc-ctl--next" data-tl-control="" {...revealItem(2, 'fade')}>
            <IconButton type="button" variant="secondary" size="xl" rounded="full" className="uc-btn" aria-label="Next use case" onClick={() => userStep(1)}>
              <ChevronRight aria-hidden strokeWidth={2} />
            </IconButton>
          </span>
          <span className="uc-count" aria-hidden="true" {...revealItem(2, 'fade')}>
            <span className="uc-roll">
              <span className="uc-roll-col" style={{ '--ci': at } as CSSProperties}>
                {list.map((c, i) => (
                  <span key={c.id}>{pad(i + 1)}</span>
                ))}
              </span>
            </span>
            <span className="uc-count-of">/ {pad(n)}</span>
          </span>
        </>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
    </div>
  );
}
