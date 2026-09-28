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
 */
import { CalendarClock, Play, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { ArmedButton } from '@/components/ArmedButton';
import { Said, type SaidNote } from '@/components/Said';
import { type Flow, type Run, push, runSkill } from '@/lib/api';
import { refreshLive } from '@/lib/live';
import { useAccount } from '@/shell/AccountProvider';
import { Page } from '@/shell/Surface';
import { ScheduleFor, Schedules } from '@/features/tests/Schedules';
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

  const run = async (flow: Flow, given: Record<string, string>) => {
    setBusy(flow.id);
    setNote(null);
    try {
      await runSkill(flow.id, given);
      setAsking(null);
      setValues({});
      setNote({ text: `"${flow.name}" is queued. It starts as soon as the computer picks it up — follow it on Logs.`, kind: 'good' });
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
          A run that worked in Create can be saved as a skill. Run it again from here, or put it on a clock and
          it runs by itself while the computer is awake.
        </Typography>
      </div>

      <Said note={note} onDismiss={() => setNote(null)} />

      <section className={CARD}>
        <Typography variant="span" className={cn(LABEL, 'block')}>
          {skills.length ? `${skills.length} skill${skills.length === 1 ? '' : 's'}` : 'nothing yet'}
        </Typography>

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

                  {clocking === flow.id && (
                    <ScheduleFor
                      flowId={flow.id}
                      name={flow.name}
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

      {/* ЧТО ИДЁТ САМО - полоса сама себя не рисует, когда расписаний нет (см. Schedules.tsx). */}
      <Schedules reloadKey={key} onNote={onNote} />
    </Page>
  );
};
