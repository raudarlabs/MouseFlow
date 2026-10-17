/* A value that changes during a demo - a chip that becomes another chip, a status word, a pill - as layers
 * stacked in one grid cell: the box is as wide as the widest value and never jumps, and the change is a
 * crossfade (fade), a short vertical slide (slide) or a roll (roll, as the clock's digits). Only opacity and
 * transform move.
 *
 *   <CueSwap kind="slide" values={[{ at: 0, node: <StatusChip>Test · Invoice total is right</StatusChip> },
 *                                  { at: 4000, node: <StatusChip>by itself · from a schedule</StatusChip> }]} />
 *
 * At rest (the server, reduced motion, ?still) only the LAST value shows - the poster is the final frame.
 * Without a timeline the earlier values never show; give them meaning in text elsewhere if they carry any.
 */
import type { ReactNode } from 'react';
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';

export interface CueSwapValue {
  at: number;
  node: ReactNode;
}

export function CueSwap({ values, kind = 'fade', className }: { values: CueSwapValue[]; kind?: 'fade' | 'slide' | 'roll'; className?: string }) {
  return (
    <span className={cn('hl-swap', kind !== 'fade' && `hl-swap--${kind}`, className)}>
      {values.map((v, i) => (
        <span key={i} {...cue(v.at, 'none', values[i + 1]?.at)} aria-hidden={i < values.length - 1 ? true : undefined}>
          {v.node}
        </span>
      ))}
    </span>
  );
}
