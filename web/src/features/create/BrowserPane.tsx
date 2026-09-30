/* Браузер рядом с разговором - как у Claude: слева просьба, справа страница, в которой её делают.
 *
 * ЗАЧЕМ (владелец, 2026-10-01). «Юзер создаёт отдельный чат под каждую задачу, и если для задачи требуется
 * браузер, мы всё делаем внутри приложения, никуда не нужно переходить - он просто логинится во вкладке».
 *
 * ПОЧЕМУ КАРТИНКА, А НЕ iframe. Почти каждый сервис, ради которого сюда придут (почта, CRM, банк), запрещает
 * показывать себя внутри чужой страницы, и управлять таким окном со своей страницы браузер не даст. Поэтому
 * страницу держит отдельный Chrome на этой машине (OwnBrowser в агенте), позади остальных окон, а здесь - его
 * живая картинка и наши клики и клавиши, отданные ему обратно.
 *
 * ПАРОЛЬ НЕ ПОПАДАЕТ НА НАШ СЕРВЕР. Всё, что набрано в панели, идёт со страницы на 127.0.0.1 и оттуда в
 * Chrome по pipe. Сервер MouseFlow в этом пути не участвует - и это сказано под панелью, потому что человек,
 * которого просят войти в почту внутри чужого приложения, вправе спросить.
 *
 * ВКЛАДКА НА ЗАДАЧУ: `tab` - id разговора. Вход на сайты общий: куки у профиля одни, и войти один раз -
 * значит войти для всех задач.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: Touch ID и passkey, выбор файла, системные окна - они рисуются не в странице и в картинку
 * не попадают. Для них кнопка «настоящее окно».
 */
import { ArrowLeft, ArrowRight, ExternalLink, Globe, RotateCw, X } from 'lucide-react';
import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import {
  type BrowserInput, AgentError, browserFrame, browserInput, browserNav, browserShow,
} from '@/lib/agent';

/* Движения мыши без нажатия - не чаще раза в 80 мс: наведение нужно меню и подсказкам, но поток координат
 * на каждый пиксель - это сотни запросов в секунду к машине ради того, что глаз не отличит. */
const MOVE_EVERY_MS = 80;

/* Клавиши, у которых нет буквы, - имя их KeyboardEvent.key. Остальное с одним символом идёт буквой. */
const NAMED = new Set(['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
  'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

/* Модификаторы в форме CDP: Alt=1, Ctrl=2, Meta=4, Shift=8. */
const modifiersOf = (e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) =>
  (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);

/** Адрес, как его набирают: «mail.google.com» - это https://mail.google.com. */
export const addressOf = (said: string) => {
  const text = said.trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
};

export const BrowserPane = ({ port, tab, onClose }: { port: number; tab: string; onClose: () => void }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [page, setPage] = useState<{ w: number; h: number } | null>(null);
  const [url, setUrl] = useState('');
  const [typed, setTyped] = useState('');
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const lastMove = useRef(0);

  /* ПОТОК - долгим опросом: агент держит запрос до полутора секунд и отвечает, как только страница
   * изменилась. Неподвижная страница не стоит ничего, а изменившаяся приходит без задержки опроса. */
  useEffect(() => {
    let alive = true;
    let since = 0;
    const loop = async () => {
      while (alive) {
        try {
          const got = await browserFrame(port, tab, since);
          if (!alive) return;
          if (got.fresh && got.png) {
            since = got.seq;
            setSrc(`data:image/jpeg;base64,${got.png}`);
            if (got.cssW && got.cssH) setPage({ w: got.cssW, h: got.cssH });
            setProblem(null);
          }
          if (got.url !== undefined) setUrl(got.url);
          /* Ответ без номера кадра - браузер не запущен (или не может быть, у сборки «только смотрит»).
           * Спросить снова сразу значило бы крутить запросы к машине без паузы. */
          if (typeof got.seq !== 'number') {
            if (got.running === false) setProblem('The browser is not running on this Mac.');
            await new Promise((done) => setTimeout(done, 1500));
          }
        } catch (err) {
          if (!alive) return;
          setProblem(err instanceof AgentError && err.status === 404
            ? 'This agent has no browser of its own yet. Update the MouseFlow agent on this Mac.'
            : err instanceof Error ? err.message : 'the browser did not answer');
          await new Promise((done) => setTimeout(done, 2000));
        }
      }
    };
    void loop();
    return () => { alive = false; };
  }, [port, tab]);

  useEffect(() => { if (!editing) setTyped(url === 'about:blank' ? '' : url); }, [url, editing]);

  const send = useCallback((input: BrowserInput) => {
    void browserInput(port, tab, input).catch((err) => {
      setProblem(err instanceof Error ? err.message : 'the browser did not take that');
    });
  }, [port, tab]);

  /** Точка на картинке → точка страницы в CSS-пикселях. Картинка растянута по ширине панели, без полей. */
  const at = (e: { clientX: number; clientY: number }) => {
    const box = image.current?.getBoundingClientRect();
    if (!box || !page) return null;
    return {
      x: Math.max(0, Math.min(page.w, ((e.clientX - box.left) / box.width) * page.w)),
      y: Math.max(0, Math.min(page.h, ((e.clientY - box.top) / box.height) * page.h)),
    };
  };

  const onMouse = (kind: 'down' | 'up' | 'move') => (e: MouseEvent) => {
    const p = at(e);
    if (!p) return;
    if (kind === 'move') {
      const now = Date.now();
      if (now - lastMove.current < MOVE_EVERY_MS) return;
      lastMove.current = now;
      send({ type: 'mouse', kind, ...p, buttons: e.buttons });
      return;
    }
    if (kind === 'down') surface.current?.focus();
    e.preventDefault();
    send({ type: 'mouse', kind, ...p, count: e.detail || 1 });
  };

  /* Колесо - слушателем без passive, иначе preventDefault не работает и вместе со страницей в панели
   * прокручивалась бы вся колонка. */
  useEffect(() => {
    const el = image.current;
    if (!el) return undefined;
    const wheel = (e: WheelEvent) => {
      const p = at(e);
      if (!p) return;
      e.preventDefault();
      send({ type: 'wheel', ...p, dx: e.deltaX, dy: e.deltaY });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const onKey = (e: KeyboardEvent) => {
    /* ⌘V - вставка ЗДЕСЬ, из буфера этой машины: страница Chrome своего буфера не прочтёт из-за нашей
     * спины. Обрабатывается событием paste ниже; здесь только не мешаем ему. */
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') return;
    const modifiers = modifiersOf(e);
    if (NAMED.has(e.key)) {
      e.preventDefault();
      send({ type: 'key', key: e.key, code: e.code, modifiers });
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      send({ type: 'key', key: e.key, code: e.code, text: e.key, modifiers });
    }
  };

  const go = async (address: string) => {
    const target = addressOf(address);
    if (!target) return;
    setEditing(false);
    setUrl(target);
    try {
      await browserNav(port, tab, { url: target });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'that address did not open');
    }
  };

  const move = (to: 'back' | 'forward' | 'reload') => {
    void browserNav(port, tab, { move: to }).catch(() => {});
  };

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border-stroke border bg-surface-card">
      <div className="flex shrink-0 items-center gap-1 border-stroke border-b px-2 py-1.5">
        <Button size="xs" variant="ghost" aria-label="Back" onClick={() => move('back')} className="px-1.5">
          <ArrowLeft className="size-4" />
        </Button>
        <Button size="xs" variant="ghost" aria-label="Forward" onClick={() => move('forward')} className="px-1.5">
          <ArrowRight className="size-4" />
        </Button>
        <Button size="xs" variant="ghost" aria-label="Reload" onClick={() => move('reload')} className="px-1.5">
          <RotateCw className="size-4" />
        </Button>
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => { e.preventDefault(); void go(typed); }}
        >
          <input
            value={typed}
            onChange={(e) => { setEditing(true); setTyped(e.target.value); }}
            onBlur={() => setEditing(false)}
            placeholder="Type an address — mail.google.com"
            aria-label="Address"
            className={cn(
              'h-7 w-full rounded-md border-stroke border bg-surface-card2 px-2 text-[0.8rem] text-ink-primary',
              'placeholder:text-ink-inactive focus:border-input-focus focus:outline-none',
            )}
          />
        </form>
        {/* Для того, что в картинку не попадает: Touch ID, passkey, выбор файла, системные окна. */}
        <Button
          size="xs"
          variant="ghost"
          title="Open the real window — for Touch ID, passkeys, choosing a file"
          aria-label="Open the real window"
          onClick={() => void browserShow(port, tab).catch(() => {})}
          className="px-1.5"
        >
          <ExternalLink className="size-4" />
        </Button>
        <Button size="xs" variant="ghost" aria-label="Close the browser pane" onClick={onClose} className="px-1.5">
          <X className="size-4" />
        </Button>
      </div>

      <div
        ref={surface}
        tabIndex={0}
        onKeyDown={onKey}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (text) { e.preventDefault(); send({ type: 'text', text }); }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn('relative min-h-0 flex-1 overflow-y-auto bg-white outline-none',
          focused && 'ring-2 ring-brand-primary/50 ring-inset')}
      >
        {src ? (
          <img
            ref={image}
            src={src}
            alt={url || 'the page'}
            draggable={false}
            onMouseDown={onMouse('down')}
            onMouseUp={onMouse('up')}
            onMouseMove={onMouse('move')}
            onContextMenu={(e) => e.preventDefault()}
            className="block w-full select-none"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Globe className="size-6 text-ink-inactive" />
            <Typography variant="p" className="max-w-[40ch] text-[0.85rem] text-ink-inactive">
              {problem ?? 'Starting the browser…'}
            </Typography>
          </div>
        )}
      </div>

      <Typography variant="p" className="shrink-0 border-stroke border-t px-3 py-1.5 text-[0.72rem] text-ink-inactive">
        {problem && src ? <span className="text-fb-red-text">{problem} · </span> : null}
        Sign in here once and it stays signed in. What you type goes from this page to the MouseFlow agent
        on this Mac, and nowhere else.
      </Typography>
    </aside>
  );
};
