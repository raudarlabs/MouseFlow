/* Devices - машины аккаунта, и команда каждой из них или нескольким сразу (Hivelink H2).
 *
 * ЗАЧЕМ (владелец, 2026-10-16): «юзер может поставить наш агент на 10 компов, дать каждому имя, потом зайти
 * в свою админку, увидеть все компы в списке и давать каждому из них отдельные команды».
 *
 * ЧТО ЗДЕСЬ МОЖНО СДЕЛАТЬ С МАШИНОЙ - только то, что сервер и агент уже умеют, без новой версии агента:
 *  - дать имя (PATCH /api/sync?token=), поставить на паузу из аккаунта (сервер перестаёт выдавать ей работу -
 *    агент слышит «работы нет», поэтому это работает на любой его версии), отозвать доступ;
 *  - отправить ЦЕЛЬ словами или СКИЛЛ - одной машине или выбранным (POST /api/queue с `devices`): по строке
 *    очереди на машину, и ответ называет, где встало, а где нет и почему;
 *  - остановить то, что машина делает сейчас (та же отмена, что на Logs).
 * Записи здесь нет и не будет: Hivelink даёт команды, а не показывает (владелец, 2026-10-16).
 *
 * ЧЕСТНОСТЬ ЧИСЕЛ - как на Overview: «на связи» - токен спрашивал работу в последние 90 с; счёт работ по
 * машине - только когда сервер его отдаёт (после миграции 025), иначе так и сказано.
 */
import { Link } from '@tanstack/react-router';
import { Copy, KeyRound, Monitor, Pause, Pencil, Play, Plus, Send, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { ArmedButton } from '@/components/ArmedButton';
import { Said, type SaidNote } from '@/components/Said';
import {
  type Device, type EnrollCode, type Flow, type LiveJob, cancelJob, commandMachines, devices, dropEnrollCode,
  enrollCodes, isMachine, liveJobs, machineName, machineOnline, makeEnrollCode, nameDevice, pauseDevice, revokeDevice,
} from '@/lib/api';
import { macEnrollCommand, windowsEnrollCommand } from '@/lib/agent';
import { refreshLive } from '@/lib/live';
import { useAccount } from '@/shell/AccountProvider';
import { Page } from '@/shell/Surface';
import { when } from '@/features/create/run-history';
import { dotClass } from '@/features/activity/status';

const LABEL = 'text-[0.7rem] uppercase tracking-wide text-ink-inactive';
const CARD = 'rounded-xl border-stroke border bg-surface-card p-4';
const FIELD = 'h-8 rounded-md border-stroke border bg-surface-card2 px-2.5 text-[0.85rem] text-ink-primary placeholder:text-ink-inactive focus:border-input-focus focus:outline-none';
/* Перечитывать машины и их работы - статус «на связи» и «что делает» меняются сами. */
const POLL_MS = 10_000;

interface Param { name: string; example?: string | null }
const paramsOf = (flow: Flow): Param[] => {
  const payload = (flow.payload ?? {}) as { params?: Param[] };
  return (Array.isArray(payload.params) ? payload.params : []).filter((p) => p && p.name);
};

type Status = 'paused' | 'online' | 'offline';
const statusOf = (one: Device, now: number): Status =>
  one.paused ? 'paused' : machineOnline(one, now) ? 'online' : 'offline';
const STATUS_DOT: Record<Status, 'good' | 'attention' | 'neutral'> = { online: 'good', paused: 'attention', offline: 'neutral' };

/* Имя, которое можно поменять по нажатию, - как на Overview. */
const NameCell = ({ one, fallback, onNamed }: {
  one: Device;
  fallback: string;
  onNamed: (name: string | null) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(one.name || '');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setWhy(null);
    try {
      const answer = await nameDevice(one.id, draft.trim());
      onNamed(answer.name);
      setEditing(false);
    } catch (err) {
      setWhy(err instanceof Error ? err.message : 'the name was not saved');
    } finally {
      setBusy(false);
    }
  };
  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <form className="flex items-center gap-1.5" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
          <input
            autoFocus
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            placeholder={one.hostname || 'Office-3'}
            aria-label="Machine name"
            maxLength={60}
            className={cn(FIELD, 'h-7 min-w-0 flex-1')}
          />
          <Button size="xs" type="submit" isLoading={busy}>Save</Button>
          <Button size="xs" variant="ghost" onClick={() => { setEditing(false); setDraft(one.name || ''); setWhy(null); }}>Cancel</Button>
        </form>
        {why && <Said note={{ text: why, kind: 'bad' }} variant="inline" />}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Give this machine a name"
      className="group flex min-w-0 flex-col items-start text-left"
    >
      <span className="flex max-w-full items-center gap-1.5 text-[0.9rem] text-ink-primary">
        <span className="truncate">{machineName(one, fallback)}</span>
        <Pencil className="size-3 shrink-0 text-ink-inactive opacity-0 group-hover:opacity-100" />
      </span>
      {one.name && one.hostname && one.hostname !== one.name && (
        <span className="truncate text-[0.74rem] text-ink-inactive">{one.hostname}</span>
      )}
    </button>
  );
};

/* КОМАНДА - цель словами или скилл с его значениями. Одна форма на одну машину и на несколько: выбранные
 * галочками строки - это и есть адресаты. */
const Composer = ({ targets, names, onSent }: {
  targets: string[];
  names: Map<string, string>;
  onSent: (note: SaidNote) => void;
}) => {
  const { flows } = useAccount();
  const skills = useMemo(() => flows.filter((one) => one.kind === 'created'), [flows]);
  const [mode, setMode] = useState<'goal' | 'skill'>('goal');
  const [goal, setGoal] = useState('');
  const [skillId, setSkillId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const skill = skills.find((one) => one.id === skillId) || null;
  const params = skill ? paramsOf(skill) : [];
  const ready = targets.length > 0 && (mode === 'goal' ? goal.trim().length > 0 : !!skill);

  const send = async () => {
    setBusy(true);
    try {
      const answer = await commandMachines(mode === 'goal'
        ? { devices: targets, goal: goal.trim() }
        : { devices: targets, skill: skillId, arguments: values });
      const nameOf = (id: string) => names.get(id) || id;
      /* ИСХОД КАЖДОЙ МАШИНЫ - словами: встало на двух, а третья на паузе, - это то, что человек должен
       * прочитать, а не одно «отправлено». */
      const went = answer.queued.map((one) => nameOf(one.device));
      /* Отказ сервера уже называет машину («Office-3 is paused…») - второй раз имя не ставится. */
      const not = answer.refused.map((one) => one.why);
      onSent({
        text: [
          went.length ? `Sent to ${went.join(', ')}. Follow it on Logs.` : '',
          ...not,
        ].filter(Boolean).join(' '),
        kind: went.length ? 'good' : 'bad',
      });
      if (went.length && mode === 'goal') setGoal('');
      void refreshLive();
    } catch (err) {
      onSent({ text: err instanceof Error ? err.message : 'the command was not sent', kind: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Typography variant="span" className={cn(LABEL, 'block')}>
            {targets.length ? `to ${targets.length} machine${targets.length === 1 ? '' : 's'}` : 'pick machines below'}
          </Typography>
          <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.2rem]">Give a command</Typography>
        </div>
        <div className="flex rounded-lg border-stroke border bg-surface-card2 p-0.5" role="group" aria-label="What to send">
          {(['goal', 'skill'] as const).map((one) => (
            <button
              key={one}
              type="button"
              onClick={() => setMode(one)}
              className={cn('rounded-md px-3 py-1 text-[0.8rem]',
                mode === one ? 'bg-surface-card text-ink-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary')}
            >
              {one === 'goal' ? 'A goal in words' : 'A skill'}
            </button>
          ))}
        </div>
      </div>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(ev) => { ev.preventDefault(); if (ready) void send(); }}
      >
        {mode === 'goal' ? (
          <textarea
            value={goal}
            onChange={(ev) => setGoal(ev.target.value)}
            rows={2}
            placeholder="What should they do — “open the September report and export it as PDF”"
            aria-label="Goal"
            className={cn(FIELD, 'h-auto py-2 leading-snug')}
          />
        ) : !skills.length ? (
          <Typography variant="p" className="text-[0.85rem] text-ink-inactive">
            No skills yet. Save one from <Link to="/create" className="text-brand-primary hover:underline">Create</Link> after a
            run that worked, and it can be sent to any machine from here.
          </Typography>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={skillId}
              onChange={(ev) => { setSkillId(ev.target.value); setValues({}); }}
              aria-label="Skill"
              className={cn(FIELD, 'max-w-[24rem] flex-1')}
            >
              <option value="">Choose a skill…</option>
              {skills.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
            </select>
            {params.map((p) => (
              <input
                key={p.name}
                value={values[p.name] ?? ''}
                onChange={(ev) => setValues((was) => ({ ...was, [p.name]: ev.target.value }))}
                placeholder={p.example ? `${p.name} — e.g. ${p.example}` : p.name}
                aria-label={p.name}
                className={cn(FIELD, 'min-w-[10rem] flex-1')}
              />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" type="submit" leftSlot={<Send className="size-4" />} isLoading={busy} disabled={!ready}>
            {targets.length > 1 ? `Send to ${targets.length} machines` : 'Send'}
          </Button>
          <Typography variant="span" className="text-[0.78rem] text-ink-inactive">
            Each machine gets its own job and does it on its own screen. A busy or paused machine says so and
            the rest still go.
          </Typography>
        </div>
      </form>
    </section>
  );
};

/* ДОБАВИТЬ МАШИНЫ БЕЗ БРАУЗЕРА НА НИХ (Hivelink H3). Код выпускается здесь один раз - на одну машину или на
 * партию, - и команда установки с ним подключает каждую сама: на машине не надо входить в аккаунт. Код
 * показывается один раз (сервер хранит только хэш), поэтому его можно скопировать сразу и нельзя потом. */
const USES = [1, 5, 10, 25, 50] as const;
const HOURS = [{ h: 24, said: '24 hours' }, { h: 72, said: '3 days' }, { h: 168, said: 'a week' }] as const;

const AddMachines = ({ onNote }: { onNote: (note: SaidNote) => void }) => {
  const [open, setOpen] = useState(false);
  const [uses, setUses] = useState<number>(1);
  const [hours, setHours] = useState<number>(24);
  const [name, setName] = useState('');
  const [made, setMade] = useState<{ code: string; uses: number; expiresAt: string } | null>(null);
  const [codes, setCodes] = useState<EnrollCode[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCodes = useCallback(async () => {
    try { setCodes((await enrollCodes()).codes); } catch (_) { setCodes([]); }
  }, []);
  useEffect(() => { if (open) void loadCodes(); }, [open, loadCodes]);

  const make = async () => {
    setBusy(true);
    try {
      const answer = await makeEnrollCode(uses, hours);
      setMade(answer);
      void loadCodes();
    } catch (err) {
      onNote({ text: err instanceof Error ? err.message : 'the code was not made', kind: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); onNote({ text: 'Copied.', kind: 'good' }); } catch (_) { /* selectable anyway */ }
  };

  if (!open) {
    return (
      <Button size="sm" variant="secondary" leftSlot={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        Add machines
      </Button>
    );
  }
  return (
    <section className={cn(CARD, 'w-full')}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Typography variant="span" className={cn(LABEL, 'block')}>Add machines</Typography>
          <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.2rem]">One code, as many machines as you say</Typography>
        </div>
        <Button size="xs" variant="ghost" onClick={() => { setOpen(false); setMade(null); }}>Close</Button>
      </div>
      <Typography variant="p" className="mt-1 max-w-[76ch] text-[0.84rem] text-ink-inactive">
        Run the command on each computer. It installs the agent and attaches it to this account with the code —
        nobody has to sign in on that machine. A machine that is already attached does not use the code up.
      </Typography>

      {!made ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.84rem] text-ink-secondary">
          For
          <select value={uses} onChange={(ev) => setUses(Number(ev.target.value))} aria-label="How many machines" className={cn(FIELD, 'h-8')}>
            {USES.map((n) => <option key={n} value={n}>{n} machine{n === 1 ? '' : 's'}</option>)}
          </select>
          valid for
          <select value={hours} onChange={(ev) => setHours(Number(ev.target.value))} aria-label="How long" className={cn(FIELD, 'h-8')}>
            {HOURS.map((one) => <option key={one.h} value={one.h}>{one.said}</option>)}
          </select>
          <Button size="sm" leftSlot={<KeyRound className="size-4" />} isLoading={busy} onClick={() => void make()}>Make a code</Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-md border-stroke border bg-surface-card2 px-3 py-1.5 font-mono text-[1.1rem] tracking-wider text-ink-primary">
              {made.code}
            </code>
            <Typography variant="span" className="text-[0.8rem] text-ink-inactive">
              for {made.uses} machine{made.uses === 1 ? '' : 's'}, until {new Date(made.expiresAt).toLocaleString()} — shown once
            </Typography>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-[0.84rem] text-ink-secondary">
            Name in the command (optional — the machine can be named later)
            <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Office-3" maxLength={60}
              aria-label="Machine name for the command" className={cn(FIELD, 'w-[14rem]')} />
          </label>
          {[
            { label: 'macOS — in Terminal', text: macEnrollCommand(made.code, name), note: 'Installs it as a login item, so it is back after every restart. Needs Xcode Command Line Tools; the installer names them if they are missing.' },
            { label: 'Windows — in PowerShell', text: windowsEnrollCommand(made.code, name), note: 'Runs while that window is open. Starting at login on Windows comes with the signed installer.' },
          ].map((one) => (
            <div key={one.label}>
              <Typography variant="span" weight="semibold" className="block text-[0.84rem]">{one.label}</Typography>
              <div className="mt-1 flex items-center gap-2 rounded-md border-stroke border bg-surface-card2 p-1.5">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-1 font-mono text-[0.76rem] text-ink-primary">{one.text}</code>
                <Button variant="ghost" size="sm" leftSlot={<Copy className="size-4" />} onClick={() => void copy(one.text)}>Copy</Button>
              </div>
              <Typography variant="p" className="mt-0.5 text-[0.74rem] text-ink-inactive">{one.note}</Typography>
            </div>
          ))}
          <div><Button size="xs" variant="ghost" onClick={() => setMade(null)}>Make another code</Button></div>
        </div>
      )}

      {codes && codes.length > 0 && (
        <div className="mt-4">
          <Typography variant="span" className={cn(LABEL, 'block')}>Codes still open</Typography>
          <ul className="mt-1 flex flex-col gap-1">
            {codes.map((one) => (
              <li key={one.id} className="flex flex-wrap items-center gap-3 text-[0.8rem] text-ink-secondary">
                <span>{one.uses} machine{one.uses === 1 ? '' : 's'} left</span>
                <span className="text-ink-inactive">until {one.expiresAt ? new Date(one.expiresAt).toLocaleString() : '—'}</span>
                <Button size="xs" variant="ghost" onClick={async () => {
                  try { await dropEnrollCode(one.id); void loadCodes(); onNote({ text: 'That code no longer attaches anything.', kind: 'good' }); }
                  catch (err) { onNote({ text: err instanceof Error ? err.message : 'it was not withdrawn', kind: 'bad' }); }
                }}>Withdraw</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export const DevicesView = () => {
  const [rows, setRows] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<SaidNote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const body = await devices();
      /* Старшие первыми - номер машины без имени не меняется, когда привязывают новую. */
      setRows(body.devices.filter(isMachine).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
      setFailed(null);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'the machines could not be read');
    }
    try {
      const live = await liveJobs();
      setJobs(live.jobs);
    } catch (_) {
      /* Живая лента - удобство: без неё нет кнопки Stop у строки, а сами машины уже показаны. */
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const list = rows ?? [];
  const fallbackOf = (one: Device) => `${one.label} #${list.indexOf(one) + 1}`;
  const names = new Map(list.map((one) => [one.id, machineName(one, fallbackOf(one))]));
  /* Что машина делает сейчас - работа, которую она взяла или которая к ней привязана и ждёт. */
  const jobOf = (id: string) => jobs.find((job) => job.machine?.id === id && (job.state === 'claimed' || job.state === 'queued')) || null;
  const online = list.filter((one) => statusOf(one, now) === 'online').length;
  const allPicked = list.length > 0 && list.every((one) => picked.has(one.id));

  const toggle = (id: string) => setPicked((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const act = async (id: string, what: () => Promise<unknown>, said: string) => {
    setBusy(id);
    setNote(null);
    try {
      await what();
      setNote({ text: said, kind: 'good' });
      await load();
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'it did not work', kind: 'bad' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page className="flex flex-col gap-4 py-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Typography variant="span" className={cn(LABEL, 'block')}>Devices</Typography>
          <Typography variant="h1" weight="semibold" className="mt-0.5 text-[1.7rem]">Your machines</Typography>
          <Typography variant="p" className="mt-1 max-w-[76ch] text-ink-inactive text-[0.9rem]">
            Every computer with the agent attached to this account. Name them, pick one or several, and give
            them a goal or a skill — each does it on its own screen. A machine only takes work while its agent
            is running and taking work; nothing can reach into it from here.
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/connect" className="text-[0.82rem] text-brand-primary hover:underline">Attach this computer</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <AddMachines onNote={(said) => { setNote(said); void load(); }} />
      </div>

      <Said note={note} onDismiss={() => setNote(null)} />
      {failed && <Said note={{ text: failed, kind: 'bad' }} />}

      <Composer targets={[...picked]} names={names} onSent={(said) => { setNote(said); void load(); }} />

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography variant="span" className={cn(LABEL, 'block')}>
            {rows ? `${list.length} machine${list.length === 1 ? '' : 's'} · ${online} online` : 'reading…'}
          </Typography>
          {list.length > 0 && (
            <label className="flex items-center gap-2 text-[0.8rem] text-ink-secondary">
              <input
                type="checkbox"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(list.map((one) => one.id)))}
              />
              Pick all
            </label>
          )}
        </div>

        {rows && !list.length ? (
          <div className="py-8 text-center">
            <Monitor className="mx-auto size-6 text-ink-inactive" />
            <Typography variant="p" className="mt-2 text-[0.88rem] text-ink-inactive">
              No machine is attached yet. Press <span className="text-ink-body">Add machines</span> for a code and a
              command to run on each computer, or attach this one from{' '}
              <Link to="/connect" className="text-brand-primary hover:underline">Connections</Link>.
            </Typography>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-[0.84rem]">
              <thead>
                <tr className="text-left text-[0.72rem] uppercase tracking-wide text-ink-inactive">
                  <th className="w-8 py-2 pe-2" aria-label="Pick" />
                  <th className="py-2 pe-3">Machine</th>
                  <th className="py-2 pe-3">Status</th>
                  <th className="py-2 pe-3">Now</th>
                  <th className="py-2 pe-3">30 days</th>
                  <th className="py-2 pe-3">Agent</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((one) => {
                  const status = statusOf(one, now);
                  const job = jobOf(one.id);
                  return (
                    <tr key={one.id} className={cn('border-stroke/45 border-t align-top', picked.has(one.id) && 'bg-surface-card2')}>
                      <td className="py-2.5 pe-2">
                        <input type="checkbox" checked={picked.has(one.id)} onChange={() => toggle(one.id)}
                          aria-label={`Pick ${names.get(one.id)}`} />
                      </td>
                      <td className="max-w-[16rem] py-2.5 pe-3">
                        <NameCell
                          one={one}
                          fallback={fallbackOf(one)}
                          onNamed={(name) => setRows((was) => (was ?? []).map((m) => (m.id === one.id ? { ...m, name } : m)))}
                        />
                      </td>
                      <td className="py-2.5 pe-3 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('size-2 rounded-full', dotClass(STATUS_DOT[status]))} aria-hidden />
                          <span className="text-ink-body">{status}</span>
                        </span>
                        {status !== 'online' && (
                          <span className="block text-[0.74rem] text-ink-inactive">
                            {one.lastUsedAt ? `seen ${when(one.lastUsedAt)}` : 'never connected'}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[16rem] py-2.5 pe-3">
                        {job ? (
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-ink-body" title={job.goal || job.name}>
                              {job.state === 'queued' ? 'waiting: ' : ''}{job.goal || job.name}
                            </span>
                            <Button
                              size="xs"
                              variant="ghost"
                              leftSlot={<Square className="size-3" />}
                              isLoading={busy === job.id}
                              onClick={() => void act(job.id, () => cancelJob(job.id),
                                job.state === 'queued' ? 'Cancelled.' : 'Stopping — it ends at its next step.')}
                            >
                              Stop
                            </Button>
                          </span>
                        ) : <span className="text-ink-inactive">—</span>}
                      </td>
                      <td className="py-2.5 pe-3 whitespace-nowrap tabular-nums">
                        {one.jobs
                          ? <>{one.jobs.done} done{one.jobs.failed ? <span className="text-fb-red-text"> · {one.jobs.failed} failed</span> : null}</>
                          : <span className="text-ink-inactive" title="Counted per machine once database migration 025 is applied">not counted yet</span>}
                      </td>
                      <td className="py-2.5 pe-3 whitespace-nowrap text-ink-secondary">
                        {one.platform || one.version ? `${one.platform || ''} ${one.version || ''}`.trim() : '—'}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            leftSlot={<Send className="size-3" />}
                            onClick={() => setPicked(new Set([one.id]))}
                            title="Send a command to this machine only"
                          >
                            Command
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            leftSlot={one.paused ? <Play className="size-3" /> : <Pause className="size-3" />}
                            isLoading={busy === one.id}
                            title={one.paused
                              ? 'Let it take work again'
                              : 'It finishes what it is doing and takes nothing new until resumed'}
                            onClick={() => void act(one.id, () => pauseDevice(one.id, !one.paused),
                              one.paused ? `${names.get(one.id)} takes work again.`
                                : `${names.get(one.id)} is paused: it takes no new work until you resume it.`)}
                          >
                            {one.paused ? 'Resume' : 'Pause'}
                          </Button>
                          <ArmedButton
                            label="Remove"
                            armedLabel="Remove — press again"
                            armed={armed === one.id}
                            busy={busy === one.id}
                            onArm={() => setArmed(one.id)}
                            onDisarm={() => setArmed(null)}
                            onConfirm={() => {
                              setArmed(null);
                              void act(one.id, () => revokeDevice(one.id),
                                `${names.get(one.id)} is no longer attached. Its agent stops getting work; attach it again from Connections.`);
                            }}
                            icon={<Trash2 className="size-3" />}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Page>
  );
};
