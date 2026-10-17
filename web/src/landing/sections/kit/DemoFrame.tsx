/* A DEMO'S FRAME AND ITS TWO CONTROLS.
 *
 * DemoFrame is the <figure> every animated mock lives in. Its figcaption carries the meaning for a screen
 * reader (the mock itself is aria-hidden), and, when given, the visible caption under it - "Illustration,
 * played about 3× faster than a real run." - so nobody mistakes a drawing for a recording.
 *
 * PlayToggle is the Pause/Play every demo that moves on its own for more than 5s must have (WCAG 2.2.2).
 * A toggle button: its name stays "Pause the demo" and aria-pressed says whether it is paused - the ARIA
 * pattern, rather than a label that flips and a state that flips with it. It is marked data-tl-control, so
 * pointing at it or focusing it does not pause the demo it controls. With reduced motion there is nothing
 * to pause: it keeps its place but is hidden and out of the tab order.
 *
 * ReplayButton appears when a one-shot demo has ended.
 *
 * Both are the design system's own buttons (IconButton, Button) in the page's glass, like every real
 * control on the landing.
 */
import type { ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { IconButton } from '@insightis/ui/IconButton';
import { cn } from '@insightis/ui/cn';
import type { Timeline } from '../../motion';

export interface DemoFrameProps {
  /** What the demo shows, for screen readers: "Example: the test … judged passed by three checks …". */
  label: string;
  /** The visible caption under the demo: "Illustration, played about 3× faster than a real run." */
  caption?: ReactNode;
  className?: string;
  captionClassName?: string;
  children: ReactNode;
}

export function DemoFrame({ label, caption, className, captionClassName, children }: DemoFrameProps) {
  return (
    <figure className={cn('hl-demo', className)}>
      {children}
      <figcaption className={cn(caption ? 'hl-caption' : 'sr-only', captionClassName)}>
        {caption ? (
          <>
            <span className="sr-only">{label} </span>
            {caption}
          </>
        ) : (
          label
        )}
      </figcaption>
    </figure>
  );
}

export interface PlayToggleProps {
  timeline: Timeline;
  /** The button's name. Default "Pause the demo". */
  label?: string;
  className?: string;
}

export function PlayToggle({ timeline, label = 'Pause the demo', className }: PlayToggleProps) {
  const off = !timeline.motion;
  const paused = timeline.paused || timeline.ended;
  return (
    <IconButton
      type="button"
      variant="secondary"
      size="sm"
      rounded="full"
      className={cn('hl-iconbtn', className)}
      aria-label={label}
      aria-pressed={paused}
      title={paused ? 'Play' : 'Pause'}
      data-tl-control=""
      data-off={off ? '' : undefined}
      tabIndex={off ? -1 : undefined}
      aria-hidden={off || undefined}
      onClick={timeline.toggle}
    >
      {paused ? <Play aria-hidden strokeWidth={2.2} /> : <Pause aria-hidden strokeWidth={2.2} />}
    </IconButton>
  );
}

export interface ReplayButtonProps {
  timeline: Timeline;
  /** Default "Replay the example". */
  label?: string;
  /** icon: a 32px glass circle (for a tile's corner); text: a text button with the icon. */
  variant?: 'icon' | 'text';
  className?: string;
}

export function ReplayButton({ timeline, label = 'Replay the example', variant = 'icon', className }: ReplayButtonProps) {
  const on = timeline.motion && timeline.ended;
  const common = {
    type: 'button' as const,
    'data-tl-control': '',
    tabIndex: on ? undefined : -1,
    'aria-hidden': on ? undefined : true,
    onClick: timeline.replay,
  };
  if (variant === 'text') {
    return (
      <Button {...common} variant="ghost" size="sm" rounded="full" className={cn('hl-textbtn hl-replay', on && 'is-on', className)} leftSlot={<RotateCcw aria-hidden strokeWidth={2.2} />}>
        {label}
      </Button>
    );
  }
  return (
    <IconButton {...common} variant="secondary" size="sm" rounded="full" aria-label={label} className={cn('hl-iconbtn hl-replay', on && 'is-on', className)}>
      <RotateCcw aria-hidden strokeWidth={2.2} />
    </IconButton>
  );
}
