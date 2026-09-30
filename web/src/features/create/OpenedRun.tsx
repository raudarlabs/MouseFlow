/* Прошлый прогон, открытый как разговор — в главной области, а не щелью в сайдбаре.
 *
 * ЧТО БЫЛО НЕ ТАК (владелец, 2026-09-28). История стояла колонкой внутри самой Create (EarlierPanel) и
 * раскрывалась там же, на месте: строка разворачивалась в двадцать два рема ширины, и шаги прогона ломались
 * в ней по два слова. То есть вся запись о том, что случилось на настоящей машине, читалась в щели - а это
 * ровно то, за чем на страницу и возвращаются.
 *
 * ПРОГОН - ЭТО РАЗГОВОР, КОТОРЫЙ УЖЕ СОСТОЯЛСЯ, поэтому он открывается там, где ведут новые, и тем же
 * экраном (`/create/$runId`). Не отдельной страницей: у одного и того же появилось бы два вида и два
 * набора кнопок, и первый же разошедшийся оставил бы половину действий доступной только из одного места.
 * Под ним - то же поле ввода: «Ask again» кладёт в него цель, и её можно поправить прежде, чем послать.
 *
 * ЧТО ЗДЕСЬ НЕ ПРИДУМАНО ЗАНОВО. Ни одно правило чтения: слова прогона, шаги, исход, «можно ли сделать
 * скилл» приезжают из run-history.ts и verdict.ts. Всё, что умела колонка, переехало сюда целиком -
 * переименование, кадры, итог, объяснение пустых шагов и названная ошибка, - потому что убрать колонку и
 * потерять по дороге кнопку значило бы сделать не редизайн, а вычитание.
 *
 * ПЕРЕИМЕНОВАНИЕ НЕ ТРОГАЕТ ЦЕЛЬ: правится подпись, а цель остаётся тем, что действительно ушло в работу и
 * что пошлёт «Ask again». См. db/013_run_named.sql.
 *
 * УДАЛЕНИЕ УДАЛЯЕТ. Строка прогона - его единственная запись: удалённый исчезает и из итогов, и из того, что
 * видит ассистент. Отсюда второй вопрос (ArmedButton) и сказанное вслух, что уходит.
 */
import { useCallback, useState } from 'react';
import { Check, Pencil, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { ArmedButton } from '@/components/ArmedButton';
import { StepLine } from '@/components/chat';
import type { Flow, Run } from '@/lib/api';
import { useAgent } from '@/lib/store';
import { type DictatedRun, hasSkillForRun } from '@/lib/save-as-skill';
import { asDid, describe } from './describe';
import { Frames } from './Frames';
import { dictatedFrom, provable, stepsOf, titleOf, took, when, wordsOf } from './run-history';
import { evidenceOf, verdictKind } from './verdict';

export function OpenedRun({
  run, flows, onAskAgain, onSaveAsSkill, onRename, onDelete, onClose,
}: {
  run: Run;
  flows: Flow[];
  onAskAgain: (goal: string) => void;
  onSaveAsSkill: (run: DictatedRun, goal: string) => void;
  /** Пустое имя стирает подпись и возвращает строке её собственную цель. Бросает, если не записалось. */
  onRename: (id: string, name: string | null) => Promise<void>;
  /** Бросает, если не записалось. */
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  /* Какой машиной подписывать аккорды: на маке `ctrl` в шаге - это ⌘. См. describe. */
  const { health } = useAgent();
  const platform = health?.platform;
  const [armed, setArmed] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const steps = stepsOf(run);
  const words = wordsOf(run);
  const length = took(run);
  const note = run.summary ?? run.error ?? null;

  /* Ошибка называется строкой под кнопками, а не глотается: молчащий отказ выглядит как «удалилось», а
   * строка потом вернётся при следующей перезагрузке аккаунта. */
  const act = useCallback(async (what: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await what();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'the account did not take that change');
    } finally {
      setBusy(false);
    }
  }, []);

  const saveName = () => {
    const name = (naming ?? '').trim();
    setNaming(null);
    void act(() => onRename(run.id, name || null));
  };

  return (
    /* Шапка разговора, а не карточка: рамка вокруг прошлого прогона сделала бы его вложением в новый,
     * а он ему предшествует. Линия снизу - граница между тем, что было, и тем, что можно попросить. */
    <div className="flex flex-col gap-3 border-stroke border-b pb-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {naming !== null ? (
            /* Поле стоит НА МЕСТЕ названия: видно, что именно правится и чему это имя достанется. */
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={naming}
                onChange={(ev) => setNaming(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Escape') { ev.preventDefault(); setNaming(null); }
                  if (ev.key === 'Enter') { ev.preventDefault(); saveName(); }
                }}
                placeholder={run.goal ?? 'Name this run'}
                aria-label="Name for this run"
                className={cn(
                  'min-w-0 flex-1 rounded-md border-brand-primary/60 border bg-surface-card2',
                  'px-2 py-1 text-[0.95rem] text-ink-primary',
                  'placeholder:text-ink-inactive focus:outline-none',
                )}
              />
              <Button variant="ghost" size="sm" aria-label="Save this name" isLoading={busy} onClick={saveName}>
                <Check className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" aria-label="Leave the name as it was" onClick={() => setNaming(null)}>
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <Typography variant="p" weight="semibold" className="text-[1.05rem] text-ink-primary">
              {titleOf(run)}
            </Typography>
          )}
          <Typography variant="p" className="mt-0.5 text-[0.78rem] text-ink-inactive tabular-nums">
            {[when(run.startedAt), length && `took ${length}`,
              run.outcome === 'running' ? 'never finished' : null].filter(Boolean).join(' · ')}
          </Typography>
          {/* НАЗВАН - значит цель под ним всё ещё видна: подпись не должна подменять собой то, что на
            * самом деле запускали, иначе «Ask again» пошлёт неожиданное. */}
          {run.name && run.name.trim() && run.goal && (
            <Typography variant="p" className="mt-1 text-[0.8rem] text-ink-inactive italic">
              asked for: {run.goal}
            </Typography>
          )}
        </div>
        <Button size="sm" variant="ghost" aria-label="Close this run" onClick={onClose} className="px-2">
          <X className="size-4" />
        </Button>
      </div>

      {/* Шаги во всю ширину разговора - то, ради чего этот экран и появился. */}
      <div className="flex flex-col gap-1">
        {words.map((word, i) => (
          <StepLine key={`w${i}`} kind="say">{word}</StepLine>
        ))}
        {steps.map((step, i) => (
          /* Проверка красится по своему исходу: в отчёте по тесту это единственное, что читают. */
          <StepLine key={`s${i}`} kind={verdictKind(step)}>
            {describe(asDid(step), platform)}
            {evidenceOf(step)}
          </StepLine>
        ))}
        {/* ШАГОВ НЕ ВИДНО - это три разных случая, а не один. Пустое место во всех трёх говорило бы «ничего
          * не делал», а это враньё про чужую запись - то, что читают как «продукт потерял мои данные». */}
        {!steps.length && (
          <StepLine kind="waiting">
            {run.outcome === 'running'
              ? 'This one never reported that it finished.'
              : Array.isArray(run.steps) && run.steps.length
                ? `${run.steps.length} steps, in the browser extension’s own shape — this page reads the `
                  + 'desktop agent’s.'
                : 'No step-by-step trace was kept for this run.'}
          </StepLine>
        )}
        {/* Кадры - под шагами: они есть у горстки прогонов (тех, что проверяли или упали). */}
        <Frames runId={run.id} />
        {note && (
          <Typography
            variant="p"
            className={cn('mt-0.5 text-[0.85rem]', run.outcome === 'ok' ? 'text-fb-green' : 'text-fb-red-text')}
          >
            {note}
          </Typography>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* ЦЕЛЬ, А НЕ ПОДПИСЬ: в поле ложится то, что действительно уходило в работу, - повторить как есть
          * или поправить перед отправкой. */}
        <Button
          size="sm"
          leftSlot={<RotateCcw className="size-4" />}
          onClick={() => onAskAgain(run.goal || '')}
          disabled={!run.goal}
        >
          Ask again
        </Button>
        {/* Исчезает, когда скилл уже сделан: второе приглашение сделать то же самое читается как «первое
          * не сработало». Условие - общее с лентой (provable). */}
        {provable(run) && (
          hasSkillForRun(flows, run.id) ? (
            <Typography variant="p" className="ms-1 text-ink-inactive text-[0.8rem]">Saved as a skill.</Typography>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              leftSlot={<Sparkles className="size-4" />}
              onClick={() => onSaveAsSkill(dictatedFrom(run), run.goal || '')}
            >
              Save as skill
            </Button>
          )
        )}
        <Button
          size="sm"
          variant="ghost"
          leftSlot={<Pencil className="size-4" />}
          onClick={() => setNaming(run.name ?? '')}
        >
          Rename
        </Button>
        <ArmedButton
          label="Delete"
          armedLabel="Delete for good — press again"
          armed={armed}
          busy={busy}
          onArm={() => setArmed(true)}
          onDisarm={() => setArmed(false)}
          onConfirm={() => { setArmed(false); void act(() => onDelete(run.id)); }}
          icon={<Trash2 className="size-4" />}
        />
      </div>

      {problem && (
        <Typography variant="p" className="text-fb-red-text text-[0.8rem]">{problem}</Typography>
      )}
    </div>
  );
}
