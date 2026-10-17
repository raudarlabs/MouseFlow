/* ONE NIGHT'S SHEET - the run view in Logs, distilled: the steps as the run wrote them, the three checks
 * with their outcome, tier and evidence, the verdict the machine computed from them, the frame it kept, and
 * one sentence on what that colour means.
 *
 * Rendered at its final frame (the poster: the server, reduced motion, ?still); every line carries the cue at
 * which it arrives on the console's timeline. Without a script the three sheets stack, each under its own
 * heading ("Mon 02:00 · passed"); enhanced, they share one grid cell and the tabs pick one.
 *
 * The frame is a drawing of the same Billing window 01 ran in - aria-hidden; what it shows is in the text.
 */
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';
import { BillingWindow, CheckLine, CueSwap, FrozenFrame, HexDot, Lines, StatusChip, StepLine, VerdictBar } from '../kit';
import { at, type NightDef } from './script';

/** The step's node on the run's rail: ice for what it did, a hollow grey for what it could not. */
const Node = ({ muted }: { muted?: boolean }) => <HexDot kind={muted ? 'paused' : 'ice'} size={8} />;

export interface SheetProps {
  night: NightDef;
  enhanced: boolean;
  /** Where this sheet sits against the one on show: before it, on show, or after it (which way it slides). */
  place: 'before' | 'current' | 'after';
  id: string;
  tabId: string;
}

export function Sheet({ night, enhanced, place, id, tabId }: SheetProps) {
  const t = (ms: number) => at(night, ms);
  const fail = night.kind === 'fail';
  return (
    <div
      id={id}
      className={cn('vd-sheet', `vd-sheet--${night.kind}`, enhanced && `is-${place}`)}
      role={enhanced ? 'tabpanel' : undefined}
      aria-labelledby={enhanced ? tabId : undefined}
      tabIndex={enhanced && place === 'current' ? 0 : undefined}
    >
      <div className="vd-sheet-head">
        <h3 className="vd-sheet-h">
          <span className="vd-sheet-day">
            {night.day} <span className="vd-sheet-time">02:00</span>
          </span>
          <span className="vd-sheet-v"> · {night.verdict}</span>
        </h3>
        <span className="vd-logs">
          <span className="vd-logs-k">Logs</span>
          <CueSwap
            kind="slide"
            className="vd-logs-swap"
            values={[
              {
                at: t(160),
                node: (
                  <StatusChip kind="live" size="sm">
                    running
                  </StatusChip>
                ),
              },
              {
                at: t(night.logsAt),
                node: (
                  <span className="vd-logs-chips">
                    {night.logs.map((l) => (
                      <StatusChip key={l.text} kind={l.kind} size="sm">
                        {l.text}
                      </StatusChip>
                    ))}
                  </span>
                ),
              },
            ]}
          />
        </span>
      </div>

      <div className="vd-sheet-body">
        <div className="vd-col vd-col--steps">
          <p className="hl-kicker vd-k">Steps</p>
          <Lines className="vd-steps" label={`Steps on ${night.dayLong}`}>
            {night.steps.map((s) => (
              <StepLine key={s.time} time={s.time} mark={<Node muted={s.tone === 'muted'} />} tone={s.tone} at={t(s.at)}>
                {s.text}
              </StepLine>
            ))}
          </Lines>
        </div>

        <div className="vd-col vd-col--checks">
          <p className="hl-kicker vd-k">Checks · read from the app</p>
          <Lines className="vd-checks" label={`Checks on ${night.dayLong}`}>
            {night.checks.map((c) => (
              <CheckLine
                key={c.n}
                n={c.n}
                statement={c.statement}
                outcome={c.outcome}
                tier={c.outcome === 'notmade' ? undefined : 'tree'}
                evidence={c.evidence}
                proves={
                  c.proves && (
                    <span {...cue(t((c.resolveAt ?? c.at) + 140), 'rise')}>
                      <span className="vd-proves-k">What it proves:</span> {c.proves}
                    </span>
                  )
                }
                at={t(c.at)}
                resolveAt={c.resolveAt === undefined ? undefined : t(c.resolveAt)}
              />
            )).flatMap((line, k) =>
              /* Wednesday: right after the red, the run says it is not over. */
              night.goesOn !== undefined && k === 0
                ? [
                    line,
                    <li key="goes-on" className="vd-goes-on" {...cue(t(night.goesOn), 'rise')}>
                      <span className="vd-goes-on-mark" aria-hidden="true">
                        ↓
                      </span>
                      The run goes on — a failed check doesn’t end it.
                    </li>,
                  ]
                : [line],
            )}
          </Lines>

          <div className={cn('vd-outcome', `vd-outcome--${night.kind}`)}>
            <VerdictBar verdict={night.kind} chip={night.verdict} at={t(night.verdictAt)} className="vd-verdict">
              {night.counts}
            </VerdictBar>
            <div className="vd-kept" {...cue(t(night.frameAt), 'none')}>
              <FrozenFrame status={night.frame.status} label={night.frame.label} lens={night.frame.lens} className="vd-frame">
                <BillingWindow total={night.frame.total} toast={night.frame.toast} signIn={night.frame.signIn} />
              </FrozenFrame>
              <span className="vd-kept-x">
                <span className="vd-kept-t">Frame kept · {night.frame.label}</span>
                <span className="vd-kept-s">{night.frame.says}</span>
              </span>
            </div>
          </div>

          <p className={cn('vd-meaning', fail && 'vd-meaning--fail')} {...cue(t(night.meaningAt), 'rise')}>
            <HexDot kind={night.kind} size={10} />
            <span>
              <b>{night.meaning[0]}</b> {night.meaning[1]}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
