/* TYPING - a string arriving character by character, the page's way of showing a person (or the bee)
 * typing. Each character is an aria-hidden span that only changes opacity, beside an sr-only copy of the
 * whole string, and the full string is laid out from the start: typing never reflows a line, and a screen
 * reader reads the words once, whole.
 *
 * It types when its cue fires on the surrounding timeline (`at`), at the page's three speeds - a person
 * 22ms a character, the bee into a field 45ms, an install command 16ms - and a line never takes longer than
 * 1.4s: a long one speeds up. A 1px ice-2 caret follows the last visible character and blinks out at the
 * end of the line. Without a timeline, in the poster and with reduced motion, it is simply the text.
 */
import type { CSSProperties, ElementType } from 'react';
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';

export const TYPE_SPEED = { person: 22, bee: 45, install: 16 } as const;
export type TypeSpeed = keyof typeof TYPE_SPEED;

/** The longest a line may take to type. */
export const TYPE_CAP_MS = 1400;

/** How long `text` takes to type at `speed` - for placing the next cue after it. */
export function typeDuration(text: string, speed: TypeSpeed | number = 'person'): number {
  const n = Array.from(text).length;
  return n * typeStep(n, speed);
}

function typeStep(n: number, speed: TypeSpeed | number): number {
  const base = typeof speed === 'number' ? speed : TYPE_SPEED[speed];
  return n ? Math.min(base, Math.floor(TYPE_CAP_MS / n)) : base;
}

export interface TypeTextProps {
  text: string;
  /** When typing starts on the surrounding timeline (ms). Without it the text is static. */
  at?: number;
  speed?: TypeSpeed | number;
  /** Show the caret while typing. Default true. */
  caret?: boolean;
  as?: ElementType;
  className?: string;
}

export function TypeText({ text, at, speed = 'person', caret = true, as: Tag = 'span', className }: TypeTextProps) {
  if (at === undefined) return <Tag className={className}>{text}</Tag>;
  const chars = Array.from(text);
  const step = typeStep(chars.length, speed);
  return (
    <Tag className={cn('hl-tt', caret && 'hl-tt--caret', className)} style={{ '--tt-step': step + 'ms' } as CSSProperties} {...cue(at, 'none')}>
      <span className="sr-only">{text}</span>
      <span className="hl-tt-v" aria-hidden="true">
        {chars.map((c, i) => (
          <span key={i} className="hl-tt-c" style={{ '--i': i } as CSSProperties}>
            {c}
          </span>
        ))}
      </span>
    </Tag>
  );
}
