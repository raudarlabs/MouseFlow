/* ADD MACHINES - the one-line install: the enrolment code set like a licence key, the line that uses it, and
 * what the machine says as it moves in. A 1px poll line runs across the top of its log, from the machine to
 * the hive, and its dots only ever travel outward - the machine asks, nothing reaches in.
 *
 * A one-shot demo (about 4s of install, then three rounds of outward polls and a static arrow). The two
 * platforms are panes (`data-act-pane="ps" | "mac"`): without a script both show, one under the other, each
 * with its heading; enhanced, the tabs pick one - the same tabs pick the tray or the menu bar in the switch
 * tile beside it - and choosing one replays the install for that platform.
 *
 * The command line is real, selectable text with no copy button: it is illustrative (the address is
 * elided). Typing is the kit's TypeText; its screen-reader copy is not selectable here, so a selection
 * copies the line once.
 */
import { useRef, type KeyboardEvent, type RefObject } from 'react';
import { Monitor } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { HiveMark } from '@/components/brand/HiveMark';
import { cue, useTimeline } from '../../motion';
import { HexDot, Lines, LogLine, Panel, PlayToggle, StatusChip, TypeText } from '../kit';
import { ENROL, PLATFORMS, type Platform } from './copy';

const ORDER: Platform[] = ['ps', 'mac'];

/* The script, in ms. */
const T = {
  code: [150, 260, 470],
  meta: 700,
  command: 900,
  log: 2450,
  logStep: 140,
  done: [2850, 3150, 3450, 3750],
  result: 4000,
  /** Three rounds of three outward polls, 3s apart; each dot crosses in 1.4s. */
  polls: 4100,
  round: 3000,
  dotStep: 400,
  cross: 1400,
  arrow: 12300,
  duration: 12600,
};

const DOTS = [0, 1, 2].flatMap((r) => [0, 1, 2].map((d) => T.polls + r * T.round + d * T.dotStep));

export const tabId = (p: Platform) => `it-tab-${p}`;
export const paneId = (where: 'enrol' | 'switch', p: Platform) => `it-${where}-${p}`;

/** PowerShell | Terminal: a real tablist (arrow keys, Home/End, roving tabindex) that drives both the
    install card and the switch tile. Hidden until enhanced - without a script both platforms are shown. */
export function PlatformTabs({ value, onChange, enhanced }: { value: Platform; onChange: (p: Platform) => void; enhanced: boolean }) {
  const refs = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)] as const;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ORDER.indexOf(value);
    const next = e.key === 'ArrowRight' ? (i + 1) % 2 : e.key === 'ArrowLeft' ? (i + 1) % 2 : e.key === 'Home' ? 0 : e.key === 'End' ? 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(ORDER[next]!);
    refs[next]?.current?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={ENROL.tabsLabel}
      className="it-tabs"
      data-enhanced={enhanced ? '' : undefined}
      data-at={value}
      data-tl-control=""
      onKeyDown={onKeyDown}
    >
      <span className="it-tabs-thumb" aria-hidden="true" />
      {ORDER.map((p, i) => (
        <Button
          key={p}
          ref={refs[i] as RefObject<HTMLButtonElement>}
          type="button"
          role="tab"
          id={tabId(p)}
          aria-selected={value === p}
          aria-controls={`${paneId('enrol', p)} ${paneId('switch', p)}`}
          tabIndex={value === p ? 0 : -1}
          variant="ghost"
          size="md"
          rounded="full"
          className="it-tab"
          onClick={() => onChange(p)}
        >
          {PLATFORMS[p].tab}
        </Button>
      ))}
    </div>
  );
}

/** The poll line: the machine on the left, the hive on the right, dots that only travel outward. */
function Poll() {
  return (
    <div className="it-poll" aria-hidden="true">
      <span className="it-poll-end it-poll-machine">
        <Monitor strokeWidth={1.6} />
      </span>
      <span className="it-poll-mid">
        <span className="it-poll-track">
          <span className="it-poll-line" />
          {DOTS.map((at) => (
            <span key={at} className="it-poll-run hl-transient" {...cue(at, 'none', at + T.cross)}>
              <i />
            </span>
          ))}
          <svg className="it-poll-arrow" viewBox="0 0 8 10" {...cue(T.arrow, 'fade')}>
            <path d="M1.5 1.2 6.3 5l-4.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="it-poll-say">
          <span className="it-poll-on">{ENROL.pollLabel}</span>
          <span className="it-poll-off">{ENROL.pollOff}</span>
        </span>
      </span>
      <span className="it-poll-end it-poll-hive">
        <HiveMark className="it-poll-mark" />
      </span>
    </div>
  );
}

function Pane({ p, current, enhanced, taking }: { p: Platform; current: boolean; enhanced: boolean; taking: boolean }) {
  const c = PLATFORMS[p];
  return (
    <div
      data-act-pane={p}
      data-current={current ? '' : undefined}
      id={paneId('enrol', p)}
      role={enhanced ? 'tabpanel' : undefined}
      aria-labelledby={enhanced ? tabId(p) : undefined}
      tabIndex={enhanced && current ? 0 : undefined}
      className="it-pane hl-focus"
    >
      <span className="hl-act-label">{c.paneLabel}</span>
      <p className="it-cmd hl-tile">
        <span className="it-cmd-prompt" aria-hidden="true">
          {c.prompt}{' '}
        </span>
        <TypeText text={c.command} at={T.command} speed="install" />
      </p>
      <div className="it-console hl-tile">
        <Poll />
        <Lines className="it-log" label={`What ${c.machine} says as it moves in`}>
          {c.log.map((line, i) => (
            <LogLine key={line} at={T.log + i * T.logStep} doneAt={T.done[i]}>
              {line.includes(c.machine) ? (
                <>
                  {line.slice(0, line.indexOf(c.machine))}
                  <b>{c.machine}</b>
                </>
              ) : (
                line
              )}
            </LogLine>
          ))}
        </Lines>
      </div>
      {/* Where it ends up: a new row in Devices. Switched off on the machine, the same row says so. */}
      <div className="it-joined" {...cue(T.result, 'rise')}>
        <span className="it-joined-label">{ENROL.inDevices}</span>
        <span className="it-joined-row hl-tile">
          {/* The status hex, as in Devices: online with its slow ring while it takes work, dim when the
              switch on the machine is off - two stacked glyphs, crossfaded. */}
          <span className="it-joined-hex" aria-hidden="true">
            <HexDot kind="online" size={12} />
            <HexDot kind="offline" size={12} />
            <i className="it-ring hl-ring" />
          </span>
          <span className="it-joined-id">
            <span className="it-joined-name">{c.machine}</span>
            <span className="it-joined-os">{c.os} · v0.29.0</span>
          </span>
          <span className="it-joined-state" {...cue(T.result + 140, 'pop')}>
            <span className="it-joined-x">
              <span className="it-joined-on" aria-hidden={!taking || undefined}>
                <StatusChip size="sm" kind="steel">
                  {ENROL.online}
                </StatusChip>
              </span>
              <span className="it-joined-off" aria-hidden={taking || undefined}>
                <StatusChip size="sm" kind="grey">
                  {ENROL.notTaking}
                </StatusChip>
              </span>
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

export interface EnrolProps {
  platform: Platform;
  onPlatform: (p: Platform) => void;
  taking: boolean;
  enhanced: boolean;
}

export function Enrol({ platform, onPlatform, taking, enhanced }: EnrolProps) {
  const root = useRef<HTMLDivElement>(null);
  /* Two acts: the code arrives (act 0), then the platform's install (act 1). Choosing the other platform is
     manual navigation to act 1 - the code stays where it is, and that platform's line types, installs and
     polls once, then holds (Play takes it on from there). */
  const tl = useTimeline(root, { duration: T.duration, acts: [0, T.command - 200] });
  const choose = (p: Platform) => {
    if (p === platform) return;
    onPlatform(p);
    tl.goToAct(1);
  };
  return (
    <figure className="hl-demo it-enrol-fig">
      <Panel ref={root} tone="steel" className="it-enrol" data-taking={taking ? 'on' : 'off'}>
        <div className="it-enrol-head">
          <div className="it-enrol-titles">
            <h3 className="hl-h3 it-h3">{ENROL.title}</h3>
            <p className="it-sub">{ENROL.sub}</p>
          </div>
          <PlayToggle timeline={tl} label="Pause the install example" />
        </div>

        <p className="it-code">
          <span className="sr-only">{ENROL.codeSr}</span>
          <span className="it-code-groups" aria-hidden="true">
            {ENROL.code.map((g, i) => (
              <span key={g} className="it-code-part">
                {i > 0 && <i className="it-code-dash">–</i>}
                <span className="it-code-g hl-tile">
                  <TypeText text={g} at={T.code[i]} speed={30} caret={false} />
                </span>
              </span>
            ))}
          </span>
        </p>
        <p className="it-meta" {...cue(T.meta, 'fade')}>
          {ENROL.meta}
        </p>

        <PlatformTabs value={platform} onChange={choose} enhanced={enhanced} />

        <div className="hl-acts it-panes" data-enhanced={enhanced ? '' : undefined}>
          {ORDER.map((p) => (
            <Pane key={p} p={p} current={p === platform} enhanced={enhanced} taking={taking} />
          ))}
        </div>
      </Panel>
      <figcaption className="hl-caption">{ENROL.caption}</figcaption>
    </figure>
  );
}
