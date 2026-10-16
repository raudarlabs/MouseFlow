/* Skills первого продукта: то, что сохранили из разговора, - запустить снова, поставить на часы, посмотреть,
 * как шло.
 *
 * ЗАЧЕМ (владелец, 2026-09-28). «Tests какая-то слишком сложная - может просто сделаем скилы? Чтобы юзер из
 * чата мог их сохранить, а тут был интерфейс, где их можно легко ставить на повтор, скедьюлить время». Это
 * подтвердили цифры аккаунта: кейсов ноль, а скиллы и их расписания - в работе. Кейсы при этом никуда не
 * делись - таблицы, api/cases.js и тулы mouseflow_case* на месте, а разовый прогон с проверками идёт через
 * mouseflow_do (кейс, живущий в чужой системе учёта). Уехал только экран.
 *
 * ПОЧЕМУ НЕ /skills. Тот экран - мастерская второго продукта (запись, процедура, схема, публикация), и на
 * шаге 7 он стал только её. Здесь другой вопрос о тех же строках user_flow: не «как это устроено», а «сделай
 * это ещё раз, и вот когда». Одни данные, два вида - как две полки документации на шаге 15.
 *
 * ТОЛЬКО СКИЛЛЫ ИЗ ЦЕЛИ. Их делает «Save as skill» в Create; записи принадлежат мастерской и проигрываются
 * там. Показать здесь и те и другие значило бы смешать «что я просил» с «что я показал руками».
 *
 * НИЧЕГО СВОЕГО. Скиллы и прогоны - из AccountProvider; расписания - те же Schedules/ScheduleFor, что стояли
 * на Tests; запуск - очередь (api/queue.js), та же, что у панели и телеграма.
 *
 * ТЕСТЫ - ЗДЕСЬ ЖЕ (владелец, 2026-10-16): «объединим скилы и тесты в один компонент - они очень близки по
 * функционалу». Кейс - это скилл плюс то, что должно быть верно в конце, поэтому его проверки стоят в
 * строке скилла: «Add checks» открывает форму, сохранённые проверки идут рядом точками ночей и вердиктом.
 * Кейс, чей скилл удалён, не прячется - он стоит отдельным списком внизу и говорит, почему не запустится.
 * Данные прежние (`user_case`, api/cases.js): миграции это слияние не просит.
 */
import { CalendarClock, ListChecks, Play, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { ArmedButton } from '@/components/ArmedButton';
import { Said, type SaidNote } from '@/components/Said';
import {
  type Case, type Device, type Flow, type Run, cases, devices, isMachine, machineName, machineOnline, push, runSkill,
} from '@/lib/api';
import { refreshLive } from '@/lib/live';
import { useAccount } from '@/shell/AccountProvider';
import { Page } from '@/shell/Surface';
import { ScheduleFor, Schedules } from '@/features/tests/Schedules';
import { CaseForm, CaseRow } from '@/features/tests/cases';
import { titleOf, when } from '@/features/create/run-history';

const LABEL = 'text-[0.7rem] uppercase tracking-wide text-ink-inactive';
const CARD = 'rounded-xl border-stroke border bg-surface-card p-4';
const FIELD = 'h-8 rounded-md border-stroke border bg-surface-card2 px-2.5 text-[0.85rem] text-ink-primary placeholder:text-ink-inactive focus:border-input-focus focus:outline-none';

/* Сколько последних прогонов показывать точками. Десять - столько же, сколько в «Recent» сайдбара. */
const DOTS = 10;

/** Параметр скилла, как его кладёт «Save as skill» (extension/skills.js читает то же). */
interface Param { name: string; example?: string | null; description?: string | null }
interface GoalPayload { goal?: string; goalTemplate?: string; params?: Param[] }

const goalPayload = (flow: Flow): GoalPayload => (flow.payload ?? {}) as GoalPayload;
const paramsOf = (flow: Flow): Param[] =>
  (Array.isArray(goalPayload(flow).params) ? goalPayload(flow).params! : []).filter((p) => p && p.name);

const dotTone = (run: Run) =>
  run.outcome === 'ok' ? 'bg-fb-green' : run.outcome === 'running' ? 'bg-fb-attention' : 'bg-fb-red';

export const SavedSkillsView = () => {
  const { flows, runs, reload } = useAccount();
  const [note, setNote] = useState<SaidNote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Какой скилл сейчас ставят на часы, и какой спрашивает значения перед запуском. */
  const [clocking, setClocking] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [armed, setArmed] = useState<string | null>(null);
  /* Меняется, когда поставили новое расписание: полоса перечитывает себя по ключу. */
  const [key, setKey] = useState(0);
  /* Тесты: проверки скиллов, прочитанные с api/cases.js. null - ещё не спросили; отказ - своим состоянием,
   * а не пустым списком: «проверок нет» и «прочитать не удалось» - разные факты. */
  const [tests, setTests] = useState<Case[] | null>(null);
  const [testsFailed, setTestsFailed] = useState<string | null>(null);
  /** Какому скиллу сейчас пишут проверки. */
  const [checking, setChecking] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    try {
      const answer = await cases();
      setTests(answer.cases);
      setTestsFailed(null);
    } catch (err) {
      setTestsFailed(err instanceof Error ? err.message : 'the checks could not be read');
      setTests([]);
    }
  }, []);

  useEffect(() => { void loadTests(); }, [loadTests]);

  /* НА КАКОЙ МАШИНЕ (Hivelink H2). Один выбор на страницу - и для «Run now», и для нового расписания: пусто -
   * на любой свободной, как было. Список машин - те же токены агентов, что на Devices. */
  const [machines, setMachines] = useState<Device[]>([]);
  const [target, setTarget] = useState('');
  useEffect(() => {
    devices()
      .then((body) => setMachines(body.devices.filter(isMachine)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))))
      .catch(() => setMachines([]));
  }, []);
  const targetName = target
    ? machineName(machines.find((one) => one.id === target) ?? { id: '', label: 'that machine', createdAt: '', lastUsedAt: null })
    : null;

  const skills = useMemo(() => flows.filter((one) => one.kind === 'created'), [flows]);
  /* Прогоны каждого скилла - по flowId, который пишет и облачный драйвер, и страница. Новые первыми. */
  const runsOf = useMemo(() => {
    const out = new Map<string, Run[]>();
    for (const run of runs) {
      if (!run.flowId) continue;
      const list = out.get(run.flowId) ?? [];
      list.push(run);
      out.set(run.flowId, list);
    }
    return out;
  }, [runs]);

  const onNote = useCallback((text: string, kind: 'good' | 'bad') => setNote({ text, kind }), []);

  /* Проверки каждого скилла - по flowId, как прогоны. Кейс без живого скилла уходит в отдельный список:
   * в строке скилла, которого нет, ему стоять негде. «Удалён» говорит только сервер (`skillGone`): кейс,
   * чей скилл просто не попал в этот список, назван иначе - иначе страница утверждала бы удаление, о
   * котором ничего не знает. */
  const { testsOf, orphans } = useMemo(() => {
    const live = new Set(skills.map((one) => one.id));
    const out = new Map<string, Case[]>();
    const lost: Case[] = [];
    for (const one of tests ?? []) {
      if (one.skillGone || !live.has(one.flowId)) { lost.push(one); continue; }
      const list = out.get(one.flowId) ?? [];
      list.push(one);
      out.set(one.flowId, list);
    }
    return { testsOf: out, orphans: lost };
  }, [skills, tests]);
  const failing = (tests ?? []).filter((one) => one.runs[0]?.verdict === 'fail').length;

  const act = useCallback(async (id: string, what: () => Promise<unknown>, said: string) => {
    setBusy(id);
    setNote(null);
    try {
      await what();
      setNote({ text: said, kind: 'good' });
      await loadTests();
      setKey((n) => n + 1);
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'it did not work', kind: 'bad' });
    } finally {
      setBusy(null);
    }
  }, [loadTests]);

  const run = async (flow: Flow, given: Record<string, string>) => {
    setBusy(flow.id);
    setNote(null);
    try {
      await runSkill(flow.id, given, target || null);
      setAsking(null);
      setValues({});
      setNote({
        text: `"${flow.name}" is queued${targetName ? ` for ${targetName}` : ''}. It starts as soon as `
          + `${targetName ? 'it' : 'a free machine'} picks it up — follow it on Logs.`,
        kind: 'good',
      });
      void refreshLive();
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'it could not be started', kind: 'bad' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (flow: Flow) => {
    setBusy(flow.id);
    setNote(null);
    try {
      const saved = await push({ deleted: [flow.id] });
      if (saved.problems?.length) throw new Error(saved.problems[0]);
      await reload();
      setNote({ text: `"${flow.name}" is deleted. Its past runs stay on Logs.`, kind: 'good' });
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'it could not be deleted', kind: 'bad' });
    } finally {
      setBusy(null);
    }
  };

  const disarm = useCallback(() => setArmed(null), []);

  return (
    <Page className="flex flex-col gap-4 py-6">
      <div>
        <Typography variant="span" className={cn(LABEL, 'block')}>Skills</Typography>
        <Typography variant="h1" weight="semibold" className="mt-0.5 text-[1.7rem]">
          Things you asked for once, ready to do again
        </Typography>
        <Typography variant="p" className="mt-1 max-w-[76ch] text-ink-inactive text-[0.9rem]">
          A run that worked in Create can be saved as a skill. Run it again from here, put it on a clock and it
          runs by itself while the computer is awake — or add checks, and it becomes a test: each run is then
          judged green when what must be true held, red when it did not, grey when nothing was proven.
        </Typography>
      </div>

      <Said note={note} onDismiss={() => setNote(null)} />

      <section className={CARD}>
        <Typography variant="span" className={cn(LABEL, 'block')}>
          {skills.length ? `${skills.length} skill${skills.length === 1 ? '' : 's'}` : 'nothing yet'}
          {tests && tests.length ? ` · ${tests.length} test${tests.length === 1 ? '' : 's'}` : ''}
          {failing ? ` · ${failing} failing` : ''}
        </Typography>
        {testsFailed && <Said note={{ text: testsFailed, kind: 'bad' }} />}
        {machines.length > 1 && (
          <label className="mt-2 flex flex-wrap items-center gap-2 text-[0.82rem] text-ink-secondary">
            Runs and new schedules go to
            <select
              value={target}
              onChange={(ev) => setTarget(ev.target.value)}
              aria-label="Machine"
              className="h-8 rounded-md border-stroke border bg-surface-card2 px-2 text-[0.82rem] text-ink-body focus:border-input-focus focus:outline-none"
            >
              <option value="">any free machine</option>
              {machines.map((one, i) => (
                <option key={one.id} value={one.id}>
                  {machineName(one, `${one.label} #${i + 1}`)}{one.paused ? ' (paused)' : machineOnline(one) ? '' : ' (offline)'}
                </option>
              ))}
            </select>
          </label>
        )}

        {!skills.length ? (
          <Typography variant="p" className="py-6 text-center text-[0.88rem] text-ink-inactive">
            Nothing saved yet. Ask for something in{' '}
            <Link to="/create" className="text-brand-primary hover:underline">Create</Link>, and when it works,
            press <span className="text-ink-body">Save as skill</span> under it.
          </Typography>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-stroke/45">
            {skills.map((flow) => {
              const mine = runsOf.get(flow.id) ?? [];
              const last = mine[0] ?? null;
              const params = paramsOf(flow);
              /* Шаблон читается словами: «{{recipient}}» - это место, которое спросят при запуске, а не текст. */
              const goal = (goalPayload(flow).goalTemplate || goalPayload(flow).goal || flow.description || '')
                .replace(/\{\{\s*([^}]+?)\s*\}\}/g, '‹$1›');
              const working = busy === flow.id;
              return (
                <li key={flow.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Typography variant="p" weight="semibold" className="text-[0.95rem] text-ink-primary">
                        {flow.name}
                      </Typography>
                      {goal && (
                        <Typography variant="p" className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-inactive">
                          {goal}
                        </Typography>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.76rem] text-ink-inactive">
                        <span>{flow.source === 'desktop' ? 'on this computer' : 'in the browser'}</span>
                        <span aria-hidden>·</span>
                        {last ? (
                          <>
                            {/* Ряд точек - последние прогоны, старые слева. Каждая открывает свой прогон
                              * тем же экраном, что строка «Recent» в сайдбаре. */}
                            <span className="flex items-center gap-1">
                              {mine.slice(0, DOTS).reverse().map((one) => (
                                <Link
                                  key={one.id}
                                  to="/create/$runId"
                                  params={{ runId: one.id }}
                                  title={`${titleOf(one)} · ${when(one.startedAt)} · ${one.outcome}`}
                                  className={cn('block size-2 rounded-full hover:ring-2 hover:ring-stroke', dotTone(one))}
                                />
                              ))}
                            </span>
                            <span>last {when(last.startedAt)}</span>
                          </>
                        ) : (
                          <span>never run from here yet</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        leftSlot={<Play className="size-4" />}
                        isLoading={working && asking !== flow.id}
                        onClick={() => {
                          if (params.length) { setAsking(asking === flow.id ? null : flow.id); setValues({}); return; }
                          void run(flow, {});
                        }}
                      >
                        Run now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftSlot={<CalendarClock className="size-4" />}
                        onClick={() => setClocking(clocking === flow.id ? null : flow.id)}
                      >
                        Repeat
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftSlot={<ListChecks className="size-4" />}
                        title="Say what must be true when it is done, and every run is judged against it"
                        onClick={() => setChecking(checking === flow.id ? null : flow.id)}
                      >
                        Add checks
                      </Button>
                      <ArmedButton
                        label="Delete"
                        armedLabel="Delete this skill — press again"
                        armed={armed === flow.id}
                        busy={working}
                        onArm={() => setArmed(flow.id)}
                        onDisarm={disarm}
                        onConfirm={() => { setArmed(null); void remove(flow); }}
                        icon={<Trash2 className="size-4" />}
                      />
                    </div>
                  </div>

                  {/* ЗНАЧЕНИЯ ПЕРЕД ЗАПУСКОМ - только у скилла, который их спрашивает. Пример стоит
                    * подсказкой и уходит, если поле оставить пустым: так же поступает драйвер. */}
                  {asking === flow.id && (
                    <form
                      className="flex flex-wrap items-center gap-2 rounded-lg border-stroke/45 border bg-surface-card2 p-3"
                      onSubmit={(ev) => { ev.preventDefault(); void run(flow, values); }}
                    >
                      {params.map((p) => (
                        <input
                          key={p.name}
                          value={values[p.name] ?? ''}
                          onChange={(ev) => setValues((was) => ({ ...was, [p.name]: ev.target.value }))}
                          placeholder={p.example ? `${p.name} — e.g. ${p.example}` : p.name}
                          aria-label={p.name}
                          title={p.description ?? p.name}
                          className={cn(FIELD, 'min-w-[12rem] flex-1')}
                        />
                      ))}
                      <Button size="sm" type="submit" isLoading={working}>Run</Button>
                    </form>
                  )}

                  {/* ПРОВЕРКИ ЭТОГО СКИЛЛА - под ним, а не на другом экране: это тот же скилл, только
                    * с ответом на «всё ещё работает?». */}
                  {(testsOf.get(flow.id) ?? []).length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {(testsOf.get(flow.id) ?? []).map((one) => (
                        <CaseRow key={one.id} one={one} busy={busy} act={act} />
                      ))}
                    </ul>
                  )}
                  {checking === flow.id && (
                    <CaseForm
                      flow={flow}
                      onCancel={() => setChecking(null)}
                      onMade={(made) => {
                        setChecking(null);
                        setTests((was) => [made, ...(was ?? [])]);
                        setNote({ text: `Checks saved for “${flow.name}”. Press Nightly to have them run by themselves.`, kind: 'good' });
                      }}
                    />
                  )}

                  {clocking === flow.id && (
                    <ScheduleFor
                      flowId={flow.id}
                      name={flow.name}
                      device={target || null}
                      onCancel={() => setClocking(null)}
                      onDone={(text) => {
                        setClocking(null);
                        onNote(text, 'good');
                        setKey((n) => n + 1);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ТЕСТЫ БЕЗ СКИЛЛА - не прячутся: такой кейс каждую ночь падает на заборе, и узнать об этом надо
        * раньше ночи. Здесь его можно только забыть. */}
      {orphans.length > 0 && (
        <section className={CARD}>
          <Typography variant="span" className={cn(LABEL, 'block')}>
            {orphans.length} test{orphans.length === 1 ? '' : 's'} without a skill here
          </Typography>
          <Typography variant="p" className="mt-1 max-w-[72ch] text-[0.82rem] text-ink-inactive">
            {orphans.every((one) => one.skillGone)
              ? 'The skill these checks ran has been deleted, so they cannot run. Their past runs stay readable.'
              : 'These checks run a skill that is not among the skills above — each row names it, and says so '
                + 'when it has been deleted. Their past runs stay readable.'}
          </Typography>
          <ul className="mt-2 flex flex-col gap-1.5">
            {orphans.map((one) => <CaseRow key={one.id} one={one} busy={busy} act={act} standalone />)}
          </ul>
        </section>
      )}

      {/* ЧТО ИДЁТ САМО - полоса сама себя не рисует, когда расписаний нет (см. Schedules.tsx). */}
      <Schedules reloadKey={key} onNote={onNote} />
    </Page>
  );
};
