/* Scroll reveals, as markup. The motion system (init.ts) does the observing; a component only says WHAT
 * reveals and in which order - with attributes the server renders, so the HTML is the finished page and the
 * reveal is something a running script adds on top. See motion.css for the kinds and the stagger.
 *
 *   <Reveal kind="panel" index={1}>…</Reveal>              an element that reveals itself
 *   <ul {...revealGroup()}> <li {...revealItem(0)}> …       a group whose items reveal together, staggered
 *   <div {...reveal('fade', 2)} className="…">              the same as <Reveal>, on your own element
 *
 * Put a reveal on something that stays where the page put it. An element that is moved out of the viewport
 * sideways (a deck card at ±200%) is never "in view" and would wait forever - reveal its stage instead.
 * And not on an element with an animation of its own (a breathing dot): the reveal IS an animation and
 * would replace it - wrap it.
 */
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';

export type RevealKind = 'up' | 'panel' | 'fade';

type RevealAttrs = { 'data-reveal': string; style?: CSSProperties };
type ItemAttrs = { 'data-reveal-item': string; style?: CSSProperties };

const indexStyle = (index?: number, style?: CSSProperties): CSSProperties | undefined =>
  index === undefined ? style : ({ ...style, '--i': index } as CSSProperties);

/** Attributes that make an element reveal itself. Merge your own style through the third argument. */
export function reveal(kind: RevealKind = 'up', index?: number, style?: CSSProperties): RevealAttrs {
  return { 'data-reveal': kind, style: indexStyle(index, style) };
}

/** Attributes for a container whose [data-reveal-item] children reveal together when it comes into view. */
export function revealGroup(style?: CSSProperties): RevealAttrs {
  return { 'data-reveal': 'group', style };
}

/** Attributes for one item of a revealGroup(): its kind and its place in the stagger. */
export function revealItem(index?: number, kind: RevealKind = 'up', style?: CSSProperties): ItemAttrs {
  return { 'data-reveal-item': kind, style: indexStyle(index, style) };
}

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  kind?: RevealKind;
  /** Stagger index: 0, 1, 2 … (70ms apart; inside .hl-stage the head's three steps are added first, and
      the sum is capped at 6 steps). */
  index?: number;
  children?: ReactNode;
}

export function Reveal({ as: Tag = 'div', kind = 'up', index, style, children, ...rest }: RevealProps) {
  return (
    <Tag {...rest} {...reveal(kind, index, style)}>
      {children}
    </Tag>
  );
}
