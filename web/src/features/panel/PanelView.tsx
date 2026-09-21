/* Композер размером с подсказку — то, что видно в нативной панели (SPLIT-PLAN §7, шаг 16).
 *
 * ПОЧЕМУ ЭТО СТРАНИЦА, А НЕ НАТИВНОЕ ОКНО С ПОЛЕМ ВВОДА. Нативное поле было бы ВТОРЫМ КОМПОЗЕРОМ: ему
 * пришлось бы отдельно выучить план, вложения и Approve, а потом держать их в ногу с первым - и делать это
 * дважды, на Swift и на C#. Панель поэтому нативная только снаружи: рамка, положение поверх всего и
 * горячая клавиша принадлежат агенту, а всё, что внутри, - это WebView вот на этой странице.
 *
 * ЧЕМ ОНА ОТЛИЧАЕТСЯ ОТ СТРАНИЦЫ CREATE, и это не «то же самое, только меньше»:
 *
 *   Create ведёт прогон САМ. Браузер говорит с агентом по локальной сети и крутит цикл в этой вкладке -
 *   что верно для вкладки, которую человек держит открытой.
 *
 *   Панель КЛАДЁТ РАБОТУ В ОЧЕРЕДЬ (api/queue.js) и умывает руки. Её закрывают через секунду после того,
 *   как сказали, что сделать; прогон, живущий в её окне, умер бы вместе с ним. Работа в очереди переживает
 *   окно: машина забирает её сама тем же `?worker=claim`, что и работу из телеграма.
 *
 * ТО ЖЕ, ЧТО В МЕССЕНДЖЕРЕ, И ЭТО НАРОЧНО. План перед запуском, Approve, услышанное дословно - человек,
 * привыкший к боту, узнаёт панель, и наоборот. Разные слова для одного и того же были бы двумя продуктами.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Send } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { type Plan, askForPlan } from '@/lib/plan';
import { langName, useDictation } from '@/features/create/dictation';
import { GOAL_MAX } from '@/features/create/attach';
import { asPanel } from '@/lib/panel-auth';

/* Как часто спрашивать, чем кончилось. Две секунды: прогон идёт минутами, а человек, глядящий в окно,
 * замечает задержку примерно с этого порога. Чаще - это опрос ради ощущения, а не ради ответа. */
const POLL_MS = 2000;

type Stage =
  | { at: 'writing' }
  | { at: 'planning' }
  | { at: 'offered'; plan: Plan }
  | { at: 'running'; id: string }
  | { at: 'over'; good: boolean; said: string };

export function PanelView() {
  const [goal, setGoal] = useState('');
  const [stage, setStage] = useState<Stage>({ at: 'writing' });
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);

  /* Надиктованное дописывается к набранному, а не заменяет его: человек, начавший печатать и
   * договоривший голосом, имел в виду одну просьбу. Тот же выбор, что у композера Create. */
  const dictation = useDictation((text) => {
    setGoal((was) => (was ? `${was} ${text}` : text).slice(0, GOAL_MAX));
    box.current?.focus();
  });

  /* Окно открывается по горячей клавише и должно быть готово принимать текст сразу - иначе первое, что
   * человек делает после нажатия, это щелчок мышью в поле, и клавиша не сэкономила ничего. */
  useEffect(() => { box.current?.focus(); }, []);

  const ask = useCallback(async () => {
    const said = goal.trim();
    if (!said || stage.at === 'planning') return;
    setProblem(null);
    setStage({ at: 'planning' });
    /* 'desktop', потому что панель живёт на той машине, на которой всё и произойдёт. */
    const { plan, error } = await askForPlan(said, 'desktop');
    if (!plan) {
      /* НЕТ ПЛАНА - НЕТ КНОПКИ, ровно как в мессенджере: «план не получился, запускаю без него» - это тот
       * самый случай, ради которого план и существует. */
      setProblem(error || 'The plan could not be built, so nothing was started.');
      setStage({ at: 'writing' });
      return;
    }
    setStage({ at: 'offered', plan });
  }, [goal, stage.at]);

  const approve = useCallback(async () => {
    setProblem(null);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', ...asPanel() },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.id) {
        /* Своими словами двери: она знает, что машины нет или что мышь занята, и говорит это фразой,
         * которую человек может выполнить. Эта страница не знает ни того, ни другого. */
        setProblem(String(body?.error?.message || `Could not start it (HTTP ${res.status}).`));
        setStage({ at: 'writing' });
        return;
      }
      setStage({ at: 'running', id: String(body.id) });
    } catch (err) {
      setProblem(`Could not reach the account: ${err instanceof Error ? err.message : 'unknown'}`);
      setStage({ at: 'writing' });
    }
  }, [goal]);

  /* Чем кончилось. Опрос, а не подписка: работа переживает это окно, и окно может быть закрыто и открыто
   * заново посреди прогона - тогда спрашивать всё равно придётся заново. */
  useEffect(() => {
    if (stage.at !== 'running') return undefined;
    let gone = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/queue?id=${encodeURIComponent(stage.id)}`,
          { credentials: 'same-origin', headers: asPanel() });
        const body = await res.json().catch(() => null);
        if (gone || !body?.done) return;
        setStage({ at: 'over', good: body.good === true, said: String(body.said || '') });
      } catch (_) {
        /* Сеть моргнула - спросим через две секунды. Прогон от этого не останавливается. */
      }
    };
    const timer = setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => { gone = true; clearInterval(timer); };
  }, [stage]);

  const again = () => { setStage({ at: 'writing' }); setProblem(null); setGoal(''); box.current?.focus(); };

  return (
    <div className="flex h-screen flex-col gap-2 bg-surface-page p-3 text-ink-primary">
      {stage.at === 'offered' ? (
        <>
          <Typography variant="h1" weight="semibold" className="text-[0.95rem]">{stage.plan.title}</Typography>
          <ol className="min-h-0 flex-1 space-y-1 overflow-auto text-[0.82rem] text-ink-body">
            {stage.plan.checkpoints.map((one, i) => (
              <li key={one.title}>
                <span className="text-ink-inactive">{i + 1}. </span>
                <span className="text-ink-primary">{one.title}</span>
                {one.detail ? <span className="text-ink-body"> — {one.detail}</span> : null}
              </li>
            ))}
          </ol>
          {/* Та же оговорка, что в мессенджере, и теми же словами: цикл реактивный, плана он не получает
            * и о нём не узнаёт. Список с номерами, выглядящий как программа, - это гарантия, которой
            * никто не давал. */}
          <Typography variant="p" className="text-[0.75rem] text-ink-inactive">
            This is what it intends, not a script — it decides each step from what is on screen.
          </Typography>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void approve()}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => setStage({ at: 'writing' })}>Change</Button>
            <Button size="sm" variant="ghost" onClick={again}>Cancel</Button>
          </div>
        </>
      ) : stage.at === 'running' ? (
        <div className="flex flex-1 items-center gap-2 text-[0.88rem] text-ink-body">
          <Loader2 className="size-4 animate-spin" />
          {/* Панель можно закрыть - и это сказано, потому что иначе её держат открытой «чтобы не
            * прервалось», а прервать её нечем: работа уже в очереди. */}
          Running on this machine. You can close this — it will finish either way.
        </div>
      ) : stage.at === 'over' ? (
        <>
          <Typography variant="p" className={cn('flex-1 text-[0.88rem]', stage.good ? 'text-ink-body' : 'text-fb-red-text')}>
            {stage.good ? 'Done' : 'Not done'} — {stage.said || (stage.good ? 'it finished.' : 'it said nothing about why.')}
          </Typography>
          <Button size="sm" variant="ghost" onClick={again}>Ask for something else</Button>
        </>
      ) : (
        <>
          <textarea
            ref={box}
            value={goal}
            onChange={(ev) => setGoal(ev.target.value.slice(0, GOAL_MAX))}
            onKeyDown={(ev) => {
              /* Enter отправляет, Shift+Enter переносит строку - как в любом поле, куда пишут фразу, а
               * не документ. Панель открывают ради одной просьбы. */
              if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void ask(); }
              /* ESCAPE ЗДЕСЬ НЕ ОБРАБАТЫВАЕТСЯ НАРОЧНО. Закрывает панель агент - см. монитор в
               * Panel.build(). `window.close()` отсюда был мёртвым кодом: WebKit исполняет его только
               * для окна, открытого скриптом, а наше открыто загрузкой. И даже живым он работал бы
               * только на этой странице, то есть не на экране входа - там, где закрыть нужнее всего. */
            }}
            disabled={stage.at === 'planning'}
            rows={3}
            placeholder={dictation.recognising
              ? 'Recognising what you said…'
              : dictation.listening
                ? 'Listening — say what it should do'
                : 'What should it do on this computer?'}
            className={cn(
              'min-h-0 flex-1 resize-none rounded border border-stroke bg-surface-card2 px-2 py-1.5',
              'text-[0.9rem] text-ink-primary placeholder:text-ink-inactive focus:outline-none',
              'disabled:opacity-disabled',
            )}
          />
          <div className="flex items-center gap-2">
            {dictation.supported && (
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? 'Stop dictating' : 'Dictate'}
                disabled={dictation.recognising || stage.at === 'planning'}
                leftSlot={dictation.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                className={cn(dictation.listening && 'text-fb-red-text')}
              >
                {dictation.recognising ? 'Recognising…' : dictation.listening ? 'Stop' : 'Dictate'}
              </Button>
            )}
            <span className="flex-1" />
            <Button
              size="sm"
              disabled={!goal.trim() || stage.at === 'planning'}
              leftSlot={stage.at === 'planning' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              onClick={() => void ask()}
            >
              {stage.at === 'planning' ? 'Planning…' : 'Plan it'}
            </Button>
          </div>
          {/* Куда уходит голос - до микрофона, а не после, и теми же словами, что у маршрута. Панель
            * маленькая, и соблазн убрать эту строку велик; она здесь именно поэтому. */}
          {/* ЯЗЫК ВЫБИРАЕТСЯ И ЗДЕСЬ. Первая редакция панели показывала его только надписью - то есть
            * человек видел «Русский» и не мог это изменить, не уходя на большую страницу. Строка,
            * называющая настройку без способа её тронуть, хуже её отсутствия. */}
          {dictation.supported && (
            <span className="flex items-center gap-1.5 text-[0.7rem] text-ink-inactive">
              {dictation.via === 'openai' ? 'Dictation goes to OpenAI ·' : 'Dictation stays here ·'}
              <select
                value={dictation.lang}
                onChange={(ev) => dictation.setLang(ev.target.value)}
                aria-label="Language to dictate in"
                className="rounded border border-stroke bg-surface-card2 px-1 py-0.5 text-ink-body"
              >
                {dictation.choices.map((tag) => (
                  <option key={tag} value={tag}>{langName(tag)}</option>
                ))}
              </select>
            </span>
          )}
        </>
      )}
      {(problem || dictation.problem) && (
        <Typography variant="p" className="text-[0.78rem] text-fb-red-text">
          {problem || dictation.problem}
        </Typography>
      )}
    </div>
  );
}
