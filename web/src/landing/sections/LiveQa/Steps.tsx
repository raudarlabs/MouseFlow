/* THE THREE STEPS - Write, Run, Judge - above the theater: the demo's chapters, and its controls.
 *
 * Without a script (and on the server) they are an ordered list: number, title and body of each step, one
 * under another on a phone and in three columns from 768 - every word on the page. Once the demo's timeline
 * owns the stage they become a WAI-ARIA tablist over the theater's side pane: on a phone a glass segmented
 * control whose pill slides to the act on show, with the active step's title and body under it; from 768
 * three columns with a progress track each. Selecting a step jumps the demo to that act, plays it once and
 * holds - autoplay stays off until Play is pressed (the engine's goToAct).
 *
 * Activation is manual: arrows move focus, Enter or Space selects. Moving through the tabs must not
 * hijack a demo somebody is watching. The progress fills follow the shared clock by writing a transform
 * on each frame - no React render per frame - and are full in the poster and with reduced motion.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@insightis/ui/Button';
import { cn } from '@insightis/ui/cn';
import { useTimelineFrame, type Timeline } from '../../motion';

export interface Step {
  n: string;
  label: string;
  title: string;
  body: string;
}

export interface StepsProps {
  steps: Step[];
  tl: Timeline;
  /** Act start times (ms), one per step, and the loop's length - for the progress fills. */
  acts: number[];
  duration: number;
  /** The side pane the tabs control. */
  panelId: string;
  idBase: string;
  label: string;
  className?: string;
}

export function Steps({ steps, tl, acts, duration, panelId, idBase, label, className }: StepsProps) {
  const enhanced = tl.enhanced;
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const fills = useRef<(HTMLElement | null)[]>([]);
  const shown = useRef<number[]>([]);
  const [focusAt, setFocusAt] = useState<number | null>(null);

  useTimelineFrame((t) => {
    for (let i = 0; i < steps.length; i++) {
      const el = fills.current[i];
      if (!el) continue;
      const a = acts[i] ?? 0;
      const b = acts[i + 1] ?? duration;
      const p = Math.round(Math.min(1, Math.max(0, (t - a) / (b - a))) * 1000) / 1000;
      if (shown.current[i] === p) continue;
      shown.current[i] = p;
      el.style.transform = `scaleX(${p})`;
    }
  }, tl);

  const select = (i: number) => tl.goToAct(i);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = steps.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    setFocusAt(next);
    tabs.current[next]?.focus();
  };

  const roving = focusAt ?? tl.act;

  return (
    <div className={cn('lqa-steps', className)} data-enhanced={enhanced ? '' : undefined}>
      {enhanced && (
        <div
          className="lqa-tabs"
          role="tablist"
          aria-label={label}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusAt(null);
          }}
        >
          <span className="lqa-tabs-pill" aria-hidden="true" />
          {steps.map((s, i) => (
            <Button
              key={s.n}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              variant="ghost"
              role="tab"
              id={`${idBase}-tab-${i}`}
              aria-selected={tl.act === i}
              aria-controls={panelId}
              aria-describedby={`${idBase}-step-${i}`}
              tabIndex={roving === i ? 0 : -1}
              data-i={i}
              className="lqa-tab"
              onClick={() => select(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="lqa-tab-in">
                <span className="lqa-track" aria-hidden="true">
                  <i
                    className="lqa-track-fill"
                    ref={(el) => {
                      fills.current[i] = el;
                    }}
                  >
                    <i className="lqa-track-ice" />
                    <i className="lqa-track-honey" />
                  </i>
                </span>
                <span className="lqa-tab-n">{s.n}</span> <span className="lqa-tab-l">{s.label}</span>
              </span>
            </Button>
          ))}
        </div>
      )}
      <ol className="lqa-copies">
        {steps.map((s, i) => (
          /* A click on a step's words selects it too (a pointer convenience: the tab is the keyboard's way). */
          <li
            key={s.n}
            className="lqa-copy"
            data-i={i}
            data-current={enhanced && tl.act === i ? '' : undefined}
            onClick={enhanced ? () => select(i) : undefined}
          >
            <p className="lqa-copy-k">
              <span className="lqa-tab-n">{s.n}</span> <span className="lqa-tab-l">{s.label}</span>
            </p>
            <h3 className="hl-h3">{s.title}</h3>
            <p className="hl-body" id={`${idBase}-step-${i}`}>
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
