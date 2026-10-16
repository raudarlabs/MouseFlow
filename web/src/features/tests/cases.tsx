/* Тест-кейсы как часть скилла: строка кейса, его прогоны и форма проверок.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ (владелец, 2026-10-16): «объединим скилы и тесты в один компонент - они очень
 * близки по функционалу». Они и были одним: кейс - это скилл плюс то, что должно быть верно, когда он
 * отработал (`user_case.flow_id` обязателен, db/021). Экран Tests показывал кейсы отдельным списком, и
 * человек видел один и тот же скилл в двух местах с двумя наборами кнопок. Теперь кейсы рисуются в строке
 * своего скилла на /saved, а здесь лежат кирпичи, из которых эта строка собрана.
 *
 * ЧЕТЫРЕ ИСХОДА, И «no verdict» НЕ КРАСНЫЙ. Слова и правило - в api/_case.mjs, один раз для сервера, тулов
 * и этой страницы; цвета - в ./verdicts.ts. Ночь, в которую агент не смог открыть приложение, покрашенная
 * наравне с найденным дефектом, - самый быстрый способ добиться, чтобы отчёт перестали читать.
 */
import { ChevronDown, ChevronRight, Clock, Play, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { Said } from '@/components/Said';
import { StepLine } from '@/components/chat';
import {
  type Case, type CaseRun, type Expect, type Flow, caseAdd, caseRemove, caseRun, scheduleAdd, schedulePause,
  scheduleRemove,
} from '@/lib/api';
import { refreshLive } from '@/lib/live';
import { useAgent } from '@/lib/store';
import { asDid, describe } from '@/features/create/describe';
import { evidenceOf, verdictKind } from '@/features/create/verdict';
import { Frames } from '@/features/create/Frames';
import { took, when } from '@/features/create/run-history';
import { chipClass, dotClass, type Tone } from '@/features/activity/status';
import { verdictChip, verdictTone, verdictWhy } from './verdicts';
import { EXPECTS_MAX, checksFor, expectLine } from '../../../../api/_case.mjs';

export const LABEL = 'text-[0.7rem] uppercase tracking-wide text-ink-inactive';
const ROW = 'rounded-lg border-stroke/45 border bg-surface-card2 px-3 py-2';
const FIELD = 'h-8 w-full rounded-md border-stroke border bg-surface-card2 px-2.5 text-[0.85rem] text-ink-primary placeholder:text-ink-inactive focus:border-input-focus focus:outline-none';
const SELECT = 'h-8 rounded-md border-stroke border bg-surface-card2 px-2 text-[0.82rem] text-ink-body focus:border-input-focus focus:outline-none';

const TITLE = 'min-w-0 truncate text-[0.88rem] text-ink-primary';

/* НОЧНАЯ РЕГРЕССИЯ - это время суток и рабочие дни, и оно предлагается одной кнопкой, а не формой на пять
 * полей. Два часа ночи - потому что кейс двигает настоящую мышь: в это время за компьютером обычно никого
 * нет, и одна мышь никому не мешает. Зону присылает браузер: сервер её не знает, а «02:00» по UTC - это для
 * половины мира середина рабочего дня. */
export const NIGHTLY = { at: '02:00', days: 'weekdays' as const };

export const zoneOfBrowser = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {
    return 'UTC';
  }
};

export const Chip = ({ label, tone, title }: { label: string; tone: Tone; title?: string }) => (
  <span
    title={title}
    className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap', chipClass(tone))}
  >
    {label}
  </span>
);

/* РЯД ПОСЛЕДНИХ НОЧЕЙ - точками, старые слева. Именно ряд, а не «последний вердикт»: одна зелёная точка
 * ничего не говорит о том, стабилен ли кейс, а «зелёный, зелёный, серый, серый, серый» говорит - и говорит
 * не про продукт, а про то, что три ночи никто ничего не узнал. */
export const Dots = ({ runs }: { runs: CaseRun[] }) => {
  if (!runs.length) return <span className="text-[0.76rem] text-ink-inactive">never run</span>;
  return (
    <span className="flex items-center gap-1">
      {[...runs].reverse().map((run) => (
        <span
          key={run.id}
          title={`${when(run.finishedAt || run.startedAt)} — ${verdictWhy(run.verdict)}`}
          className={cn('size-2 rounded-full', dotClass(verdictTone(run.verdict)))}
        />
      ))}
    </span>
  );
};

/** Строка одного утверждения - тем же текстом, которым его прочитает модель. */
export const Checks = ({ expects }: { expects: Expect[] }) => (
  <div className="flex flex-col gap-0.5">
    {expects.map((one, i) => (
      <Typography key={`${one.check}${one.name}${i}`} variant="p" className="font-mono text-[0.78rem] text-ink-secondary">
        {i + 1}. {expectLine(one)}
        {/* МОМЕНТ - ТЕМИ ЖЕ СЛОВАМИ, ЧТО В ЦЕЛИ. Модель читает «[when: …]», и человек обязан видеть
          * ровно это: строка отчёта и строка цели, разошедшиеся формулировкой, - две разные проверки
          * на вид. */}
        {one.after ? <span className="text-ink-tertiary"> [when: {one.after}]</span> : null}
      </Typography>
    ))}
  </div>
);

/* ОДИН ПРОГОН КЕЙСА, раскрытый: вердикт, слова, шаги и кадры. Тем же `describe`, `verdictKind` и `Frames`,
 * которыми их рисует история на Create: вторая манера показывать шаги означала бы, что человек, привыкший
 * к одной, на второй странице читает медленнее. */
const RunRow = ({ run }: { run: CaseRun }) => {
  const { health } = useAgent();
  const [open, setOpen] = useState(false);
  const chip = verdictChip(run.verdict);
  const steps = Array.isArray(run.steps) ? (run.steps as { tool?: string; input?: Record<string, unknown> }[]) : [];
  const words = Array.isArray(run.said) ? (run.said as unknown[]).filter((one) => typeof one === 'string') as string[] : [];
  const length = took(run);
  return (
    <li className={ROW}>
      <div
        onClick={() => setOpen(!open)}
        className="grid cursor-pointer grid-cols-[1rem_9rem_auto_minmax(0,1fr)_4rem_1.25rem] items-center gap-3"
      >
        <span className={cn('size-2 justify-self-center rounded-full', dotClass(chip.tone))} />
        <span className="text-[0.78rem] text-ink-inactive tabular-nums">
          {when(run.finishedAt || run.startedAt)}
        </span>
        <Chip label={chip.label} tone={chip.tone} title={verdictWhy(run.verdict)} />
        <span className="truncate text-[0.8rem] text-ink-secondary" title={run.summary || run.error || ''}>
          {run.summary || run.error || ''}
        </span>
        <span className="text-[0.78rem] text-ink-inactive tabular-nums">{length || '—'}</span>
        {open ? <ChevronDown className="size-3.5 text-ink-inactive" /> : <ChevronRight className="size-3.5 text-ink-inactive" />}
      </div>
      {open && (
        <div className="mt-2 ms-[1.25rem] flex flex-col gap-1 border-stroke/60 border-s ps-3 pe-2 pb-1">
          {/* СВОДКА ПРОВЕРОК - тремя числами, а не одним: «не удалось проверить» это не «не прошло». */}
          {run.checks && (
            <Typography variant="p" className="text-[0.78rem] text-ink-inactive">
              {run.checks.passed} held · {run.checks.failed} did not · {run.checks.unchecked} could not be checked
            </Typography>
          )}
          {/* ПРИВЯЗАННАЯ ПРОВЕРКА, СДЕЛАННАЯ ВСЁ РАВНО В КОНЦЕ (5-v2). Вердикта это не меняет - одна
            * запоздавшая проверка не отменяет найденного дефекта, - но промолчать нельзя: снаружи такой
            * прогон выглядит честным, а проверял он то, что к концу уже сдвинулось. */}
          {run.late ? (
            <Typography variant="p" className="text-[0.78rem] text-fb-attention">
              {run.late} check{run.late === 1 ? '' : 's'} bound to a moment {run.late === 1 ? 'was' : 'were'}
              {' '}made at the end anyway — a weaker test than this case says
            </Typography>
          ) : null}
          {words.map((word, i) => <StepLine key={`w${i}`} kind="say">{word}</StepLine>)}
          {steps.map((step, i) => (
            <StepLine key={`s${i}`} kind={verdictKind(step)}>
              {describe(asDid(step), health?.platform)}
              {evidenceOf(step)}
            </StepLine>
          ))}
          {run.error && <StepLine kind="error">{run.error}</StepLine>}
          <Frames runId={run.id} />
        </div>
      )}
    </li>
  );
};

/** Что строка кейса просит у страницы: выполнить действие, назвав его словами для заметки. */
export type CaseAct = (id: string, what: () => Promise<unknown>, said: string) => Promise<void>;

/* ОДИН КЕЙС В СТРОКЕ СВОЕГО СКИЛЛА: точки ночей, последний вердикт, запуск с проверками, ночная кнопка, и
 * раскрытые - утверждения, срок, прогоны и «забыть». Имя скилла здесь не повторяется, кроме случая, когда
 * скилла больше нет: тогда строка стоит в отдельном списке и обязана сказать, почему не запускается. */
export const CaseRow = ({ one, busy, act, standalone = false }: {
  one: Case;
  busy: string | null;
  act: CaseAct;
  /** Строка вне своего скилла - у удалённого скилла. Тогда она называет, что запускала. */
  standalone?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const last = one.runs[0] || null;
  const sch = one.schedule;
  return (
    <li className={ROW}>
      <div
        onClick={(ev) => {
          if ((ev.target as HTMLElement).closest('button,a,select,input')) return;
          setOpen(!open);
        }}
        className="grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)_auto_auto_auto_auto_1.25rem] items-center gap-3"
      >
        <span
          className={cn('size-2 justify-self-center rounded-full',
            dotClass(last ? verdictTone(last.verdict) : 'neutral'))}
        />
        <div className="min-w-0">
          <div className={TITLE} title={one.name}>{one.name}</div>
          <div className="truncate text-[0.76rem] text-ink-inactive">
            {/* УДАЛЁННЫЙ СКИЛЛ - НАЗВАН. Такой кейс каждую ночь падает на заборе, и узнать об этом надо
              * раньше, чем наступит ночь. */}
            {one.skillGone
              ? 'the skill it ran has been deleted — this case cannot run · '
              : standalone ? `runs “${one.skill || one.flowId}” · ` : ''}
            {one.expects.length} check{one.expects.length === 1 ? '' : 's'}
            {one.surface === 'browser' ? ' · in Chrome' : ''}
            {sch ? ` · by itself ${sch.paused ? '(paused)' : 'nightly'}` : ' · not scheduled'}
            {sch && sch.misses ? ` · ${sch.misses} missed` : ''}
          </div>
        </div>
        <Dots runs={one.runs} />
        {last ? <Chip {...verdictChip(last.verdict)} title={verdictWhy(last.verdict)} /> : <span />}
        {/* ЗАПУСК - в ту же очередь, которой кейс пойдёт ночью. Смотреть за ним идут на Logs. */}
        <Button
          size="xs"
          variant="ghost"
          leftSlot={<Play className="size-3" />}
          isLoading={busy === one.id}
          disabled={one.skillGone}
          title="Run the skill and judge these checks, exactly as its schedule would"
          onClick={() => void act(one.id, async () => {
            const answer = await caseRun(one.id);
            /* Общий опрос живого - чтобы строка появилась на Logs и в счётчике сайдбара сразу, а не через
             * пять секунд. */
            refreshLive();
            return answer;
          }, `Queued “${one.name}” with its checks. Watch it on Logs.`)}
        >
          Test now
        </Button>
        {sch ? (
          <Button
            size="xs"
            variant="ghost"
            leftSlot={<Clock className="size-3" />}
            isLoading={busy === one.id}
            title={sch.paused ? 'Let it run nightly again' : 'Stop the nightly run'}
            onClick={() => void act(one.id,
              () => (sch.paused ? schedulePause(sch.id, false) : schedulePause(sch.id, true)),
              sch.paused ? `“${one.name}” runs nightly again.` : `Paused the nightly run of “${one.name}”.`)}
          >
            {sch.paused ? 'Resume' : 'Pause'}
          </Button>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            leftSlot={<Clock className="size-3" />}
            isLoading={busy === one.id}
            disabled={one.skillGone}
            title={one.surface === 'browser'
              ? 'Every weekday at 02:00 in this browser’s own zone, in Chrome with the extension'
              : 'Every weekday at 02:00 in this browser’s own zone'}
            onClick={() => void act(one.id,
              () => scheduleAdd({
                caseId: one.id, at: NIGHTLY.at, days: NIGHTLY.days, zone: zoneOfBrowser(),
              }),
              `“${one.name}” now runs at ${NIGHTLY.at} on weekdays — while `
              + (one.surface === 'browser'
                ? 'that Chrome is open with the extension taking work.'
                : 'that machine is awake and taking work.'))}
          >
            Nightly
          </Button>
        )}
        {open ? <ChevronDown className="size-3.5 text-ink-inactive" /> : <ChevronRight className="size-3.5 text-ink-inactive" />}
      </div>

      {open && (
        <div className="mt-2 ms-[1.25rem] flex flex-col gap-2 border-stroke/60 border-s ps-3 pe-2 pb-1">
          <div>
            <Typography variant="span" className={cn(LABEL, 'block')}>What it checks</Typography>
            <div className="mt-1"><Checks expects={one.expects} /></div>
          </div>
          {sch && (
            <Typography variant="p" className="text-[0.78rem] text-ink-inactive">
              By itself: {sch.paused ? `paused — ${sch.pausedWhy || 'by hand'}` : `next ${when(sch.nextAt)}`}
              {/* УСЛОВИЕ ИСПОЛНЕНИЯ - СВОЁ У КАЖДОЙ ПОВЕРХНОСТИ. Веб-кейс ждёт не агента, а открытый Chrome
                * с расширением; тот, кто ждёт не того, чего надо, решит, что сломан продукт. */}
              {one.surface === 'browser'
                ? ' · runs only while that Chrome is open with the extension taking work'
                : ' · runs only while that computer is awake and taking work'}
              {sch.fails ? ` · ${sch.fails} failure(s) in a row` : ''}
            </Typography>
          )}
          <div>
            <Typography variant="span" className={cn(LABEL, 'block')}>
              {one.runs.length ? `Last ${one.runs.length} run${one.runs.length === 1 ? '' : 's'}` : 'Runs'}
            </Typography>
            {one.runs.length ? (
              <ul className="mt-1 flex flex-col gap-1.5">
                {one.runs.map((run) => <RunRow key={run.id} run={run} />)}
              </ul>
            ) : (
              <Typography variant="p" className="mt-1 text-[0.8rem] text-ink-inactive">
                It has never run. “Test now” queues it for this machine.
              </Typography>
            )}
          </div>
          <div>
            <Button
              size="xs"
              variant="ghost"
              leftSlot={<Trash2 className="size-3" />}
              isLoading={busy === one.id}
              title="Forget these checks. Their runs stay in the journal; their nightly schedule goes with them"
              onClick={() => void act(one.id, async () => {
                await caseRemove(one.id);
                /* Расписание кейса маршрут снимает сам - оставленное, оно каждую ночь ставило бы работу,
                 * падающую на заборе. Здесь только на случай старой строки без него. */
                if (sch && !sch.paused) await scheduleRemove(sch.id).catch(() => null);
              }, `Forgot “${one.name}”. What it already ran stays in the journal.`)}
            >
              Forget these checks
            </Button>
          </div>
        </div>
      )}
    </li>
  );
};

/* ФОРМА ПРОВЕРОК ОДНОГО СКИЛЛА. Скилл уже выбран - форма открывается из его строки, - поэтому выбора скилла
 * в ней нет: был список «Which skill runs it…», и он спрашивал то, на что человек уже ответил, нажав кнопку
 * в нужной строке. Скиллы-записи сюда не попадают вообще: запись воспроизводится агентом без модели, экран
 * никто не читает, и вызвать проверку в конце нечем. */
export const CaseForm = ({ flow, onMade, onCancel }: {
  flow: Flow;
  onMade: (made: Case) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(`${flow.name} still works`);
  const [expects, setExpects] = useState<Expect[]>([{ check: 'present', name: '', why: '' }]);
  /* ЧТО МОЖНО УТВЕРЖДАТЬ - ЗАВИСИТ ОТ СКИЛЛА: адрес страницы и точное число совпадений знает только
   * документ, а у окна приложения адреса нет вовсе. Предлагать проверку, которую этой поверхности нечем
   * сделать, - это отказ, отложенный до записи. */
  const on = flow.source !== 'desktop' ? 'browser' : 'desktop';
  const kinds = useMemo(() => checksFor(on), [on]);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);

  const setOne = (i: number, patch: Partial<Expect>) =>
    setExpects((was) => was.map((one, at) => (at === i ? { ...one, ...patch } : one)));

  /* Вид проверки, которого у этой поверхности нет, СБРАСЫВАЕТСЯ, а не остаётся выбранным втихую: иначе
   * форма показывает одно, а на сервер уезжает другое, и отказ выглядит необъяснимым. */
  useEffect(() => {
    setExpects((was) => was.map((one) => (kinds.includes(one.check) ? one : { ...one, check: kinds[0] })));
  }, [kinds]);

  const save = async () => {
    setBusy(true);
    setWhy(null);
    try {
      const made = await caseAdd({ name: name.trim(), flowId: flow.id, expects });
      onMade(made.case);
    } catch (err) {
      /* Отказ маршрута - словами маршрута. Он объясняет, ЧТО не так с утверждением, и переписывать его
       * своим «проверьте поля» значило бы выбросить единственное полезное. */
      setWhy(err instanceof Error ? err.message : 'it did not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border-stroke/45 border bg-surface-card2 p-3">
      <Typography variant="p" className="max-w-[72ch] text-[0.82rem] text-ink-inactive">
        What must be true when “{flow.name}” is done. The checks are decided by the machine from the window
        itself — never from a picture — which is what makes a nightly report worth reading.
      </Typography>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What to call it — “Outlook still sends”"
        aria-label="Test name"
        className={cn(FIELD, 'max-w-[22rem]')}
      />

      {expects.map((one, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            value={one.check}
            onChange={(e) => setOne(i, { check: e.target.value })}
            aria-label="What kind of check"
            className={SELECT}
          >
            {kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
          {/* У проверки про страницу целиком имени нет - и поле для него было бы приглашением написать то,
            * что никто не прочитает. */}
          {one.check !== 'url_is' && one.check !== 'url_contains' && (
            <input
              value={one.name}
              onChange={(e) => setOne(i, { name: e.target.value })}
              placeholder="The control, as it appears on screen"
              aria-label="Control name"
              className={cn(FIELD, 'max-w-[16rem] flex-1')}
            />
          )}
          {/* Поле значения показывается только там, где без него утверждение бессмысленно. */}
          {['value_is', 'value_contains', 'text_is', 'text_contains', 'url_is', 'url_contains', 'count_is']
            .includes(one.check) && (
            <input
              value={one.text || ''}
              onChange={(e) => setOne(i, { text: e.target.value })}
              placeholder="…must hold this text"
              aria-label="Expected text"
              className={cn(FIELD, 'max-w-[12rem] flex-1')}
            />
          )}
          <input
            value={one.why || ''}
            onChange={(e) => setOne(i, { why: e.target.value })}
            placeholder="What it proves — this is what you read in a red report"
            aria-label="What it proves"
            className={cn(FIELD, 'max-w-[24rem] flex-1')}
          />
          {/* КОГДА. Пусто - в конце прогона; заполненное - момент, который решает тот, кто видит экран: у
            * сохранённого скилла плана нет, привязывать к номеру шага было бы нечему. */}
          <input
            value={one.after || ''}
            onChange={(e) => setOne(i, { after: e.target.value })}
            placeholder="When? — empty means at the end"
            aria-label="When this is checked"
            className={cn(FIELD, 'max-w-[18rem] flex-1')}
          />
          {expects.length > 1 && (
            <Button
              size="xs"
              variant="ghost"
              aria-label="Remove this check"
              onClick={() => setExpects((was) => was.filter((_, at) => at !== i))}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="xs"
          variant="ghost"
          leftSlot={<Plus className="size-3" />}
          disabled={expects.length >= EXPECTS_MAX}
          onClick={() => setExpects((was) => [...was, { check: 'present', name: '', why: '' }])}
        >
          Another check
        </Button>
        <Button size="sm" isLoading={busy} disabled={!name.trim()} onClick={() => void save()}>
          Save the checks
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        {expects.length >= EXPECTS_MAX && (
          <Typography variant="span" className="text-[0.78rem] text-ink-inactive">
            {EXPECTS_MAX} checks is the most one test takes — more than that is usually several tests.
          </Typography>
        )}
      </div>
      {why && <Said note={{ text: why, kind: 'bad' }} variant="inline" />}
    </div>
  );
};
