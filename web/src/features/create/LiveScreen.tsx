/* Экран другого компьютера, пока на нём идёт прогон (владелец, 2026-10-17: «вижу все в лайве, но ничего
 * непонятно, что было нажато - только цифры»).
 *
 * ЧТО НА КАРТИНКЕ. Последний снимок, который та машина прислала облачному циклу, - тот самый, по которому
 * модель решила текущий ход (api/_mcp-worker.mjs, liveFrame). Поверх него - куда этот ход нажимает: точка
 * у клика и наведения, стрелка у перетаскивания. Шаги этого хода - те, что в ленте начиная с `stepNo`
 * снимка: лента удалённой карточки - это `steps` работы один к одному.
 *
 * ОПРОС С `since`. Каждые три секунды спрашивается только «тот же ли ход»; картинка едет, лишь когда
 * пришёл новый. Кончился прогон - опрос стоит, а последний кадр остаётся подписанным «the last screen it
 * sent»: строку на сервере к этому времени уже удалили.
 */
import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, MonitorPlay } from 'lucide-react';
import { cn } from '@insightis/ui/cn';
import { type LiveFrame, liveFrameOf } from '@/lib/api';
import type { RunEvent } from '@/lib/desktop-engine';
import { describe } from './describe';

const POLL_MS = 3000;

interface Mark { x: number; y: number; toX?: number; toY?: number }

const markOf = (event: RunEvent): Mark | null => {
  if (event.type !== 'tool') return null;
  const input = (event.input ?? {}) as Record<string, unknown>;
  const x = Number(input.x);
  const y = Number(input.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (event.name === 'drag') return { x, y, toX: Number(input.toX), toY: Number(input.toY) };
  return ['click', 'hover', 'scroll'].includes(String(event.name)) ? { x, y } : null;
};

export const LiveScreen = ({ runId, feed, running, machine }: {
  runId: string;
  feed: RunEvent[];
  running: boolean;
  machine: string | null;
}) => {
  const [frame, setFrame] = useState<(LiveFrame & { src: string }) | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [big, setBig] = useState(false);
  const have = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return undefined;
    let stop = false;
    const look = async () => {
      try {
        const got = await liveFrameOf(runId, have.current);
        if (stop || !got.frame || got.same || !got.frame.bytes) return;
        have.current = got.frame.stepNo;
        setFrame({ ...got.frame, src: `data:${got.frame.mime};base64,${got.frame.bytes}` });
      } catch (_) { /* the next look tries again; the steps below keep coming either way */ }
    };
    void look();
    const timer = setInterval(() => { void look(); }, POLL_MS);
    return () => { stop = true; clearInterval(timer); };
  }, [runId, running]);

  if (!frame) {
    return running ? (
      <div className="flex items-center gap-2 rounded-lg border border-stroke/60 bg-surface-card2 px-3 py-2 text-[0.78rem] text-ink-inactive">
        <MonitorPlay className="size-3.5 shrink-0" />
        The screen of {machine ?? 'that computer'} shows up here with its next step.
      </div>
    ) : null;
  }

  /* Этот ход: шаги ленты начиная со stepNo кадра. Подпись - первого из них, слова те же, что в ленте. */
  const now = feed.slice(frame.stepNo).filter((e) => e.type === 'tool');
  const marks = now.map(markOf).filter((m): m is Mark => !!m);
  const said = now[0] ? describe({ name: now[0].name, input: now[0].input }) : null;

  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-stroke/60 bg-surface-card2">
      <div className="relative">
        <img
          src={frame.src}
          alt={`The screen of ${machine ?? 'that computer'}`}
          onLoad={(ev) => setSize({ w: ev.currentTarget.naturalWidth, h: ev.currentTarget.naturalHeight })}
          className={cn('block w-full object-contain object-top', big ? 'max-h-[70vh]' : 'max-h-80')}
        />
        {size && marks.length > 0 && (
          /* Та же рамка, что у картинки: svg растянут по её натуральным пикселям, и object-contain у обоих
           * одинаковый, поэтому точка стоит там же, куда смотрела модель. */
          <svg
            viewBox={`0 0 ${size.w} ${size.h}`}
            preserveAspectRatio="xMidYMin meet"
            className="pointer-events-none absolute inset-0 size-full"
          >
            {marks.map((m, i) => (
              <g key={i}>
                {Number.isFinite(m.toX) && Number.isFinite(m.toY) && (
                  <line x1={m.x} y1={m.y} x2={m.toX} y2={m.toY} stroke="#a3e635" strokeWidth={size.w / 300} strokeDasharray={`${size.w / 120} ${size.w / 200}`} />
                )}
                <circle cx={m.x} cy={m.y} r={size.w / 60} fill="none" stroke="#a3e635" strokeWidth={size.w / 300} />
                <circle cx={m.x} cy={m.y} r={size.w / 260} fill="#a3e635" />
              </g>
            ))}
          </svg>
        )}
        <button
          type="button"
          onClick={() => setBig((was) => !was)}
          title={big ? 'Smaller' : 'Bigger'}
          className="absolute end-2 top-2 rounded-md bg-surface-card/80 p-1 text-ink-secondary hover:text-ink-primary"
        >
          {big ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>
      <figcaption className="flex items-center gap-2 px-3 py-1.5 text-[0.76rem] text-ink-secondary">
        <MonitorPlay className={cn('size-3.5 shrink-0', running ? 'text-brand-primary' : 'text-ink-inactive')} />
        <span className="min-w-0 flex-1 truncate">
          {running
            ? (said ? <>Now: <strong className="font-semibold text-ink-primary">{said}</strong></> : `${machine ?? 'That computer'}, live`)
            : 'The last screen it sent'}
        </span>
        <span className="shrink-0 text-ink-inactive tabular-nums">
          {new Date(frame.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </figcaption>
    </figure>
  );
};
