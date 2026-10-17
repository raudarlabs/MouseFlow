/* THE SWITCH ON THE MACHINE - the agent's own off switch, in its own words: the Windows tray item "Taking
 * work from your account — click to stop", the macOS menu-bar item "Let My AI Act On This Mac". The reader
 * can flip it. Off, the machine makes no calls at all - the install card's poll dots stop where they are -
 * and nothing in the account can turn it back on.
 *
 * A real <button aria-pressed> (the design system's Button): its name stays the same and the pressed state
 * says on or off, the ARIA toggle pattern. The line under it is a polite status region, so the result is
 * announced after the reader's own choice and never during anything automatic. Demo only - nothing is sent.
 *
 * The mock around the button - taskbar, menu bar, the other menu items - is drawn, aria-hidden. With reduced
 * motion the button still works; the change is an instant swap.
 */
import { useId } from 'react';
import { Battery, ChevronUp, Volume2, Wifi } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { HexDot, Panel } from '../kit';
import { SWITCH, type Platform } from './copy';
import { paneId, tabId } from './Enrol';

const ORDER: Platform[] = ['ps', 'mac'];

/** The desktop behind the menu: the page colour over the run screen's 5% hex lattice (kit/Theater.tsx), so
    this corner of a machine is the same material as every other screen on the page. */
function Lattice() {
  const id = 'it-lat' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  return (
    <svg className="it-scr-lattice" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={id} width="48" height="27.7128" patternUnits="userSpaceOnUse">
          <path
            d="M32 13.8564 28 20.7846 20 20.7846 16 13.8564 20 6.9282 28 6.9282Z M56 0 52 6.9282 44 6.9282 40 0 44-6.9282 52-6.9282Z M56 27.7128 52 34.641 44 34.641 40 27.7128 44 20.7846 52 20.7846Z M8 0 4 6.9282-4 6.9282-8 0-4-6.9282 4-6.9282Z M8 27.7128 4 34.641-4 34.641-8 27.7128-4 20.7846 4 20.7846Z"
            fill="none"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** The agent's own icon in the tray or menu bar: a hex that is green while it takes work, dim when not.
    Two stacked glyphs, crossfaded. */
const AgentIcon = () => (
  <span className="it-agent" aria-hidden="true">
    <HexDot kind="online" size={11} />
    <HexDot kind="offline" size={11} />
  </span>
);

function MenuItem({ p, taking, onToggle }: { p: Platform; taking: boolean; onToggle: () => void }) {
  const c = SWITCH[p];
  const sameWords = c.on === c.off;
  return (
    <Button
      type="button"
      variant="ghost"
      size="xl"
      rounded="lg"
      align="left"
      aria-pressed={taking}
      className="it-menu-item"
      onClick={onToggle}
    >
      <span className="it-menu-mark" aria-hidden="true">
        {p === 'mac' ? <span className="it-menu-check">✓</span> : <AgentIcon />}
      </span>
      {sameWords ? (
        <span className="it-menu-x">{c.name}</span>
      ) : (
        <>
          <span className="it-menu-x it-menu-x--swap" aria-hidden="true">
            <span className="it-menu-on">{c.on}</span>
            <span className="it-menu-off">{c.off}</span>
          </span>
          <span className="sr-only">{c.name}</span>
        </>
      )}
    </Button>
  );
}

function Pane({ p, current, enhanced, taking, onToggle }: { p: Platform; current: boolean; enhanced: boolean; taking: boolean; onToggle: () => void }) {
  const c = SWITCH[p];
  const menu = (
    <div className={`it-menu it-menu--${p}`}>
      <span className="it-menu-h" aria-hidden="true">
        {c.header}
      </span>
      <MenuItem p={p} taking={taking} onToggle={onToggle} />
      <span className="it-menu-sep" aria-hidden="true" />
      <span className="it-menu-q" aria-hidden="true">
        {c.quit}
      </span>
    </div>
  );
  const status = (
    <span className="it-sys" aria-hidden="true">
      {p === 'ps' && <ChevronUp strokeWidth={1.8} />}
      {p === 'mac' && (
        <span className="it-sys-agent">
          <AgentIcon />
        </span>
      )}
      <Wifi strokeWidth={1.8} />
      {p === 'ps' ? <Volume2 strokeWidth={1.8} /> : <Battery strokeWidth={1.8} />}
      {p === 'ps' && (
        <span className="it-sys-agent">
          <AgentIcon />
        </span>
      )}
      <span className="it-sys-clock">{c.clock}</span>
    </span>
  );
  return (
    <div
      data-act-pane={p}
      data-current={current ? '' : undefined}
      id={paneId('switch', p)}
      role={enhanced ? 'tabpanel' : undefined}
      aria-labelledby={enhanced ? tabId(p) : undefined}
      className="it-sw-pane"
    >
      <span className="hl-act-label">{c.paneLabel}</span>
      <div className={`it-scr it-scr--${p}`}>
        <Lattice />
        {p === 'mac' && (
          <div className="it-sysbar it-sysbar--mac" aria-hidden="true">
            <span className="it-sys-apps">
              <i />
              <i />
              <i />
            </span>
            {status}
          </div>
        )}
        {menu}
        {p === 'ps' && (
          <div className="it-sysbar it-sysbar--ps" aria-hidden="true">
            <span className="it-sys-apps">
              <i />
              <i />
              <i />
              <i />
            </span>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

export interface SwitchTileProps {
  platform: Platform;
  taking: boolean;
  /** The reader has flipped it at least once: from then on the line says what their choice did. */
  touched: boolean;
  onToggle: () => void;
  enhanced: boolean;
}

export function SwitchTile({ platform, taking, touched, onToggle, enhanced }: SwitchTileProps) {
  const line = !touched ? SWITCH.lineOn : taking ? SWITCH.lineBack : SWITCH.lineOff;
  return (
    <figure className="hl-demo it-switch-fig">
      <Panel className="it-switch" data-taking={taking ? 'on' : 'off'}>
        <div className="it-switch-head">
          <h3 className="hl-h3 it-h3">{SWITCH.title}</h3>
          <p className="it-sub">{SWITCH.sub}</p>
        </div>
        <div className="hl-acts it-sw-panes" data-enhanced={enhanced ? '' : undefined}>
          {ORDER.map((p) => (
            <Pane key={p} p={p} current={p === platform} enhanced={enhanced} taking={taking} onToggle={onToggle} />
          ))}
        </div>
        {/* The longest line, invisible, holds the line's height, so flipping the switch never moves the
            page; the live text sits over it in the same grid cell. */}
        <p className="it-sw-line" role="status">
          <span className="it-sw-ghost" aria-hidden="true">
            <HexDot kind="offline" size={10} />
            <span>{SWITCH.lineOff}</span>
          </span>
          <span key={line} className="it-sw-msg" data-fresh={touched ? '' : undefined}>
            <HexDot kind={taking ? 'online' : 'offline'} size={10} />
            <span>{line}</span>
          </span>
        </p>
      </Panel>
      <figcaption className="hl-caption">{SWITCH.caption}</figcaption>
    </figure>
  );
}
