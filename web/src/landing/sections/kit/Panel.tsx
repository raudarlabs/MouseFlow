/* THE ONE GLASS. Panel is the page's only card surface - the value cards' recipe (frost gradient, ice
 * hairline, inner highlight, a long shadow, a corner glow) - so every section's console, card and demo is
 * the same material. Tile is what sits inside a panel; PanelBar is a panel's 44px (48 from 1200) title row.
 *
 *   <Panel tone="soft" pad hover as="article">…</Panel>
 *   <Panel><PanelBar title="Devices · 6 machines" end={<PlayToggle …/>} /> …</Panel>
 *   <Tile pad>…</Tile>
 *
 * Plain elements, not the design system's Card: Card animates its border colour on hover, and the page's
 * motion rules allow only transform and opacity. hover adds the page's one card hover (lift 3px, an ice-2
 * ring layer fading in) - only on fine pointers.
 */
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@insightis/ui/cn';

export type PanelTone = 'ice' | 'soft' | 'steel' | 'honey';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** The corner glow: ice-2 (default), a softer ice, steel, or honey - honey is 09's alone. */
  tone?: PanelTone;
  /** Card padding from the rhythm (20 / 24 / 28). Off for a panel whose bar runs edge to edge. */
  pad?: boolean;
  /** Radius 22 at every width (a card inside a section) instead of the panel's 22 → 28. */
  card?: boolean;
  /** The card hover: lift and ring. */
  hover?: boolean;
  style?: CSSProperties;
  /** A demo's timeline root is often the panel itself. */
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

export function Panel({ as: Tag = 'div', tone = 'ice', pad, card, hover, className, children, ...rest }: PanelProps) {
  return (
    <Tag
      {...rest}
      className={cn('hl-panel', tone !== 'ice' && `hl-panel--${tone}`, pad && 'hl-panel--pad', card && 'hl-panel--card', hover && 'hl-panel--hover', className)}
    >
      {children}
    </Tag>
  );
}

export interface PanelBarProps {
  /** Mono 12px, on the left. */
  title: ReactNode;
  /** A chip or a control, on the right. */
  end?: ReactNode;
  className?: string;
}

export function PanelBar({ title, end, className }: PanelBarProps) {
  return (
    <div className={cn('hl-pbar', className)}>
      <span className="hl-pbar-title">{title}</span>
      {end && <span className="hl-pbar-end">{end}</span>}
    </div>
  );
}

export interface TileProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  pad?: boolean;
  children?: ReactNode;
}

export function Tile({ as: Tag = 'div', pad, className, children, ...rest }: TileProps) {
  return (
    <Tag {...rest} className={cn('hl-tile', pad && 'hl-tile--pad', className)}>
      {children}
    </Tag>
  );
}
