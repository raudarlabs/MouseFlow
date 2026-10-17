/* THE FOUR POINTS - what an IT reader checks before letting anything onto a machine, each on a glass cell
 * with its own glyph: it starts at logon, it only ever dials out, one code enrols many, and every machine is
 * accounted for. Then the fine print, in plain words, because what it needs and what it is not are part of
 * why it can be trusted.
 *
 * The glyphs are 24-unit line art standing on GlassCell's lid, in frost with the "this is the point" stroke
 * in ice-2 (GlassCellAccent) and a darkened panel behind (GlassCellPanel) - no honey: this section's one
 * honey is the machine being driven, in Devices.
 */
import type { ReactNode } from 'react';
import { GlassCell, GlassCellAccent, GlassCellPanel } from '@/components/brand/GlassCell';
import { revealGroup, revealItem } from '../../motion';
import { FINE, POINTS, type PointGlyph } from './copy';

/* Drawn to fill the 24-unit box, as the Rails glyphs do, so they read at 44px on a phone. */
const HEX_OUT = 'M8.6 6.4 14.2 9.6v6.6L8.6 19.4 3 16.2V9.6Z';
const FRAME = 'M3.5 6A1.5 1.5 0 0 1 5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z';

const GLYPHS: Record<PointGlyph, ReactNode> = {
  /* Starts at logon: the power mark - the ring in frost, the stroke that switches it on in ice-2. */
  power: (
    <>
      <GlassCellPanel d="M12 3.4a9 9 0 1 1 0 18a9 9 0 1 1 0-18Z" />
      <path d="M7.4 7.3a7 7 0 1 0 9.2 0" />
      <GlassCellAccent d="M12 4.6v7.2" />
    </>
  ),
  /* Asks, never listens: an arrow leaving a cell - out, never in. */
  out: (
    <>
      <GlassCellPanel d={HEX_OUT} />
      <path d={HEX_OUT} />
      <GlassCellAccent d="M8.6 12.9h12.2M17.6 9.7l3.2 3.2-3.2 3.2" />
    </>
  ),
  /* One code: a key, its bit the part that does the work. */
  key: (
    <>
      <GlassCellPanel d="M7.6 11a4.9 4.9 0 1 1 0 9.8a4.9 4.9 0 1 1 0-9.8Z" />
      <path d="M7.6 11a4.9 4.9 0 1 1 0 9.8a4.9 4.9 0 1 1 0-9.8Z" />
      <GlassCellAccent d="M11.1 12.4 20.6 3M16.4 7.2l2.6 2.6M18.6 5l2 2" />
    </>
  ),
  /* Accounted for: a list of machines, each with its hex - the first one lit. */
  list: (
    <>
      <GlassCellPanel d={FRAME} />
      <path d={FRAME} />
      <GlassCellAccent d="M7.6 7.9 9.6 9v2.2l-2 1.1-2-1.1V9Z" />
      <path d="M12 10.1h5.6" />
      <path d="M7.6 13.6 9.6 14.7v2.2l-2 1.1-2-1.1v-2.2Z" />
      <path d="M12 15.8h4" />
    </>
  ),
};

export function Points() {
  return (
    <ul className="it-points" {...revealGroup()}>
      {POINTS.map((p, i) => (
        <li key={p.title} className="it-point" {...revealItem(i)}>
          <GlassCell className="it-cell">
            <g className="it-glyph">{GLYPHS[p.glyph]}</g>
          </GlassCell>
          <div className="it-point-x">
            <h3 className="hl-h3 it-point-h">{p.title}</h3>
            <p className="hl-body it-point-p">{p.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FinePrint() {
  return (
    <div className="it-fine" {...revealGroup()}>
      <p className="it-fine-label" {...revealItem(0, 'fade')}>
        {FINE.label}
      </p>
      <ul className="it-fine-list">
        {FINE.items.map((t, i) => (
          <li key={t} {...revealItem(i + 1, 'fade')}>
            <i aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
