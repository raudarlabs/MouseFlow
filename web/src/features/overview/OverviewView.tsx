/* Overview - дом Hivelink: сколько машин подключено, сколько их сейчас на связи и что они сделали за окно.
 *
 * ЗАЧЕМ (владелец, 2026-10-16): «дешборд как хоум скрин, где видно, сколько агентов всего подключено,
 * сколько онлайн, сколько работало за прошлое время и так далее».
 *
 * ОТКУДА ЧИСЛА - и чего они пока не умеют. Здесь ничего не выдумывается, как и на Dashboard второго продукта:
 *
 *  - МАШИНЫ - это токены устройств с меткой «This computer» (её ставит привязка агента на Connections).
 *    `last_used_at` у токена сервер пишет на КАЖДОМ запросе с ним (api/_session.js), а агент, берущий работу,
 *    спрашивает очередь каждые три секунды - поэтому «на связи» = спрашивал в последнюю минуту. Агент,
 *    выключенный в трее, не спрашивает ничего и читается как «не на связи»: для того, кто даёт команды,
 *    это одно и то же.
 *  - ПРОГОНЫ - половина `?half=ran` того же api/insights.js, что считал их для прежнего дашборда.
 *  - ЧЕГО НЕТ: прогон пока не знает, на какой машине он шёл (у run_queue и user_run нет id устройства), и
 *    у всех машин одно имя. Поэтому «какая машина сколько сделала» не показано вовсе, а сказано словами -
 *    это первый шаг плана устройств (docs/HIVELINK-PLAN.md), а не цифра, которую стоило бы подставить.
 */
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { Said } from '@/components/Said';
import { type Device, type RanInsights, type Schedule, devices, ranInsights, schedules } from '@/lib/api';
import { Page } from '@/shell/Surface';
import { when } from '@/features/create/run-history';
import { dotClass } from '@/features/activity/status';

const LABEL = 'text-[0.7rem] uppercase tracking-wide text-ink-inactive';
const CARD = 'rounded-xl border-stroke border bg-surface-card p-4';

/** Метка токена, который ставит привязка агента. Другие метки - расширение («Chrome extension», «This
 *  browser») и токены, выданные руками («Device»): они не машины, которым дают команды. */
const AGENT_LABEL = 'This computer';
/* «На связи» - спрашивал работу в последнюю минуту. Агент спрашивает каждые 3 с, при сбоях отступает до
 * 60 с - больше минуты тишины значит, что он выключен, спит или не берёт работу. */
const ONLINE_MS = 60_000;
/* Как часто перечитывать машины. Счётчик «на связи» - то единственное здесь, что меняется само. */
const POLL_MS = 15_000;
const WINDOWS = [7, 30, 90] as const;

const isAgent = (one: Device) => one.label === AGENT_LABEL;
const seenWithin = (one: Device, ms: number, now: number) =>
  !!one.lastUsedAt && now - new Date(one.lastUsedAt).getTime() < ms;

/** Доля словами: «92%», и тире, когда делить не на что - ноль прогонов не «0% успеха». */
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/* Изменение к прошлому окну - только если прошлое окно было: «+12» против окна, которого не измеряли, это
 * число, взятое с потолка. */
const delta = (now: number, was: number, had: boolean) => {
  if (!had) return null;
  const d = now - was;
  return d === 0 ? 'same as before' : `${d > 0 ? '+' : ''}${d} vs the window before`;
};

const Tile = ({ label, value, sub, tone }: {
  label: string;
  value: string;
  sub?: string | null;
  tone?: 'good' | 'bad' | null;
}) => (
  <div className={CARD}>
    <Typography variant="span" className={cn(LABEL, 'block')}>{label}</Typography>
    <div className="mt-1 flex items-center gap-2">
      {tone && <span className={cn('size-2 rounded-full', dotClass(tone))} aria-hidden />}
      <Typography variant="span" weight="semibold" className="text-[1.9rem] leading-none tabular-nums text-ink-primary">
        {value}
      </Typography>
    </div>
    {sub && <Typography variant="p" className="mt-1.5 text-[0.78rem] text-ink-inactive">{sub}</Typography>}
  </div>
);

/* ПРОГОНЫ ПО ДНЯМ - столбцы, сложенные из удачных и неудачных. Две серии - легенда есть всегда; цвета -
 * статусные (удача / провал), потому что ровно это они и значат. Подпись под курсором - на каждом дне,
 * область наведения - весь столбик дня, а не только закрашенная часть. Остановленные - разница между
 * runs и ok+failed, отдельным серым. */
const Days = ({ days }: { days: RanInsights['byDay'] }) => {
  const top = Math.max(1, ...days.map((d) => d.runs));
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover == null ? null : days[hover];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 text-[0.76rem] text-ink-secondary">
        <span className="flex items-center gap-1.5"><span className={cn('size-2 rounded-sm', dotClass('good'))} />succeeded</span>
        <span className="flex items-center gap-1.5"><span className={cn('size-2 rounded-sm', dotClass('bad'))} />failed</span>
        <span className="flex items-center gap-1.5"><span className={cn('size-2 rounded-sm', dotClass('neutral'))} />stopped</span>
        <span className="ms-auto tabular-nums text-ink-inactive">
          {shown
            ? `${new Date(shown.day).toLocaleDateString([], { day: 'numeric', month: 'short' })}: ${shown.runs} run${shown.runs === 1 ? '' : 's'}, ${shown.ok} ok, ${shown.failed} failed`
            : `most in a day: ${top}`}
        </span>
      </div>
      <div className="mt-2 flex h-32 items-end gap-[2px] border-stroke/60 border-b" onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => {
          const other = Math.max(0, d.runs - d.ok - d.failed);
          return (
            <div
              key={d.day}
              onMouseEnter={() => setHover(i)}
              className={cn('flex h-full min-w-0 flex-1 flex-col justify-end', hover === i && 'bg-surface-card2')}
              title={`${d.day}: ${d.runs} runs`}
            >
              {/* Сверху вниз: остановленные, неудачные, удачные; 2px зазор между сегментами, скруглён верх. */}
              {other > 0 && <div className={cn('mb-[2px] rounded-t-[3px]', dotClass('neutral'))} style={{ height: `${(other / top) * 100}%` }} />}
              {d.failed > 0 && <div className={cn('mb-[2px]', other ? '' : 'rounded-t-[3px]', dotClass('bad'))} style={{ height: `${(d.failed / top) * 100}%` }} />}
              {d.ok > 0 && <div className={cn(other || d.failed ? '' : 'rounded-t-[3px]', dotClass('good'))} style={{ height: `${(d.ok / top) * 100}%` }} />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.72rem] text-ink-inactive tabular-nums">
        <span>{days[0] ? new Date(days[0].day).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}</span>
        <span>days in UTC</span>
        <span>{days.length ? new Date(days[days.length - 1].day).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}</span>
      </div>
    </div>
  );
};

export const OverviewView = () => {
  const [span, setSpan] = useState<(typeof WINDOWS)[number]>(7);
  const [machines, setMachines] = useState<Device[] | null>(null);
  const [machinesFailed, setMachinesFailed] = useState<string | null>(null);
  const [ran, setRan] = useState<RanInsights | null>(null);
  const [ranFailed, setRanFailed] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<Schedule[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadMachines = useCallback(async () => {
    try {
      const body = await devices();
      /* Старшие первыми - тогда номер машины не меняется, когда привязывают новую. */
      setMachines(body.devices.filter(isAgent)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
      setMachinesFailed(null);
    } catch (err) {
      setMachinesFailed(err instanceof Error ? err.message : 'the machines could not be read');
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    void loadMachines();
    const timer = setInterval(() => { void loadMachines(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadMachines]);

  useEffect(() => {
    let live = true;
    setRan(null);
    ranInsights(span)
      .then((body) => { if (live) { setRan(body); setRanFailed(null); } })
      .catch((err) => { if (live) setRanFailed(err instanceof Error ? err.message : 'the runs could not be read'); });
    return () => { live = false; };
  }, [span]);

  useEffect(() => {
    schedules()
      .then((body) => setUpcoming(body.schedules.filter((one) => !one.paused && one.nextAt)
        .sort((a, b) => String(a.nextAt).localeCompare(String(b.nextAt))).slice(0, 5)))
      .catch(() => setUpcoming([]));
  }, []);

  const windowMs = span * 86_400_000;
  const counts = useMemo(() => {
    const list = machines ?? [];
    return {
      total: list.length,
      online: list.filter((one) => seenWithin(one, ONLINE_MS, now)).length,
      active: list.filter((one) => seenWithin(one, windowMs, now)).length,
    };
  }, [machines, now, windowMs]);

  const t = ran?.totals;
  const prev = ran?.previous;

  return (
    <Page className="flex flex-col gap-4 py-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Typography variant="span" className={cn(LABEL, 'block')}>Overview</Typography>
          <Typography variant="h1" weight="semibold" className="mt-0.5 text-[1.7rem]">
            Your machines, and what they did
          </Typography>
        </div>
        {/* ОКНО - одним рядом над всеми числами, и меняет только то, что от окна зависит: «на связи» - это
          * сейчас, при любом окне. */}
        <div className="flex rounded-lg border-stroke border bg-surface-card2 p-0.5" role="group" aria-label="Window">
          {WINDOWS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setSpan(days)}
              className={cn('rounded-md px-3 py-1 text-[0.8rem]',
                span === days ? 'bg-surface-card text-ink-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary')}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ машины */}
      {machinesFailed && <Said note={{ text: machinesFailed, kind: 'bad' }} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="Machines connected"
          value={machines ? String(counts.total) : '…'}
          sub={machines && !counts.total ? 'none yet — connect one to start' : 'agents attached to this account'}
        />
        <Tile
          label="Online now"
          value={machines ? String(counts.online) : '…'}
          tone={machines ? (counts.online ? 'good' : null) : null}
          sub="asked for work in the last minute"
        />
        <Tile
          label={`Seen in ${span} days`}
          value={machines ? String(counts.active) : '…'}
          sub="machines that asked for work at least once"
        />
      </div>

      <section className={CARD}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <Typography variant="span" className={cn(LABEL, 'block')}>Machines</Typography>
            <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.2rem]">Who is listening</Typography>
          </div>
          <Link to="/connect" className="text-[0.82rem] text-brand-primary hover:underline">Connect a machine</Link>
        </div>
        {machines && machines.length ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {machines.map((one, i) => {
              const online = seenWithin(one, ONLINE_MS, now);
              return (
                <li key={one.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border-stroke/45 border bg-surface-card2 px-3 py-2">
                  <span className={cn('size-2 rounded-full', dotClass(online ? 'good' : 'neutral'))} aria-hidden />
                  <span className="min-w-[9rem] flex-1 truncate text-[0.88rem] text-ink-primary">
                    {/* У всех машин сегодня одно имя - его ставит привязка. Номер - чтобы строки различались,
                      * пока имена не дают в Devices. */}
                    {one.label} #{i + 1}
                  </span>
                  <span className="text-[0.78rem] text-ink-inactive tabular-nums">
                    {online ? 'online' : one.lastUsedAt ? `last seen ${when(one.lastUsedAt)}` : 'never connected'}
                  </span>
                  <span className="hidden text-[0.76rem] text-ink-inactive sm:inline">attached {when(one.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        ) : machines ? (
          <Typography variant="p" className="mt-2 text-[0.85rem] text-ink-inactive">
            No machine is attached yet. Install the agent on a computer and attach it from Connections — every
            machine you attach appears here.
          </Typography>
        ) : null}
        <Typography variant="p" className="mt-3 max-w-[76ch] text-[0.76rem] text-ink-inactive">
          Not counted yet: which machine ran which job, and names for machines. A run does not record the
          machine it ran on today, so a per-machine count would be a guess. Both come with Devices.
        </Typography>
      </section>

      {/* ------------------------------------------------------------------ прогоны */}
      {ranFailed && <Said note={{ text: ranFailed, kind: 'bad' }} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={`Runs in ${span} days`} value={t ? String(t.runs) : '…'}
          sub={t && prev ? delta(t.runs, prev.runs, prev.had) : null} />
        <Tile label="Succeeded" value={t ? pct(t.ok, t.runs) : '…'} tone={t && t.runs ? 'good' : null}
          sub={t ? `${t.ok} of ${t.runs}` : null} />
        <Tile label="Failed" value={t ? String(t.failed) : '…'} tone={t && t.failed ? 'bad' : null}
          sub={t && prev ? delta(t.failed, prev.failed, prev.had) : null} />
        <Tile label="Machine time" value={t ? `${t.agentHours} h` : '…'}
          sub={t && t.running ? `${t.running} running now` : 'time the machines spent on runs'} />
      </div>

      {ran && (
        <section className={CARD}>
          <Typography variant="span" className={cn(LABEL, 'block')}>By day</Typography>
          <Typography variant="h2" weight="semibold" className="mt-0.5 mb-3 text-[1.2rem]">What ran, day by day</Typography>
          {ran.byDay.some((d) => d.runs) ? <Days days={ran.byDay} /> : (
            <Typography variant="p" className="text-[0.85rem] text-ink-inactive">
              Nothing ran in this window. Ask for something in <Link to="/create" className="text-brand-primary hover:underline">Create</Link>,
              or run a skill.
            </Typography>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={CARD}>
          <Typography variant="span" className={cn(LABEL, 'block')}>Skills</Typography>
          <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.2rem]">Most run</Typography>
          {ran && ran.skills.length ? (
            <ul className="mt-2 flex flex-col divide-y divide-stroke/45">
              {ran.skills.slice(0, 6).map((one) => (
                <li key={one.flowId} className="flex items-center gap-2 py-1.5 text-[0.84rem]">
                  <span className="min-w-0 flex-1 truncate text-ink-primary">{one.name}</span>
                  <span className="tabular-nums text-ink-secondary">{one.runs}</span>
                  <span className={cn('tabular-nums text-[0.76rem]', one.failed ? 'text-fb-red-text' : 'text-ink-inactive')}>
                    {one.failed ? `${one.failed} failed` : pct(one.ok, one.runs)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Typography variant="p" className="mt-2 text-[0.82rem] text-ink-inactive">
              {ran ? 'No skill ran in this window.' : '…'}
            </Typography>
          )}
          <Link to="/saved" className="mt-2 inline-block text-[0.8rem] text-brand-primary hover:underline">All skills and tests</Link>
        </section>

        <section className={CARD}>
          <Typography variant="span" className={cn(LABEL, 'block')}>Failures</Typography>
          <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.2rem]">What went wrong most</Typography>
          {ran && ran.failures.length ? (
            <ul className="mt-2 flex flex-col divide-y divide-stroke/45">
              {ran.failures.slice(0, 5).map((one) => (
                <li key={one.reason} className="py-1.5 text-[0.82rem]">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-ink-primary" title={one.example.error || one.reason}>{one.reason}</span>
                    <span className="tabular-nums text-ink-secondary">×{one.times}</span>
                  </div>
                  {one.example.runId && (
                    <Link to="/create/$runId" params={{ runId: one.example.runId }} className="text-[0.76rem] text-brand-primary hover:underline">
                      open the last one{one.lastAt ? ` · ${when(one.lastAt)}` : ''}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Typography variant="p" className="mt-2 text-[0.82rem] text-ink-inactive">
              {ran ? 'Nothing failed in this window.' : '…'}
            </Typography>
          )}
          <Link to="/logs" className="mt-2 inline-block text-[0.8rem] text-brand-primary hover:underline">Everything on Logs</Link>
        </section>

        <section className={CARD}>
          <Typography variant="span" className={cn(LABEL, 'block')}>Coming up</Typography>
          <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.2rem]">Runs by themselves</Typography>
          {upcoming && upcoming.length ? (
            <ul className="mt-2 flex flex-col divide-y divide-stroke/45">
              {upcoming.map((one) => (
                <li key={one.id} className="py-1.5 text-[0.82rem]">
                  <div className="truncate text-ink-primary">{one.label}</div>
                  <div className="text-[0.76rem] text-ink-inactive">
                    {one.nextSaid || when(one.nextAt)}{one.misses ? ` · ${one.misses} missed` : ''}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Typography variant="p" className="mt-2 text-[0.82rem] text-ink-inactive">
              {upcoming ? 'Nothing is on a clock. Put a skill on one from Skills.' : '…'}
            </Typography>
          )}
          <Typography variant="p" className="mt-2 text-[0.74rem] text-ink-inactive">
            A scheduled run happens only while a machine is awake and taking work.
          </Typography>
        </section>
      </div>
    </Page>
  );
};
