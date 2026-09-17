/* The sidebar, following insightis/apps/web's AppSidebar.
 *
 * Their order, minus their first item. Theirs opens with New Chat because a chat is the only way in; here
 * the way in is Record, which is a place rather than an action, so a sidebar button that starts a recording
 * was a second door to a room that already has one. Record's own button does it, on the page that shows
 * what is being recorded. Below the places: what it is costing you, in hours, and who you are.
 *
 * ПУНКТЫ БОЛЬШЕ НЕ ЖИВУТ ЗДЕСЬ. Их список - в web/src/lib/product.ts, потому что у каждого экрана есть
 * ещё заголовок и шаг тура, и три списка маршрутов, обязанных совпадать, уже один раз разошлись. Здесь
 * остались ЗНАЧКИ: они представление, и тащить lucide в общий файл значило бы сделать его несбираемым
 * вне браузера, а он читается сюитой напрямую. Что значок есть у каждого пункта меню, проверяется -
 * см. web/check-web.mjs.
 *
 * Every row is RAIL square: one declared size, used by the nav, the collapse toggle and the avatar alike.
 * They each sized themselves before - 34px, 32px, 24px - which is why the collapsed rail looked ragged.
 *
 * Collapsing is remembered - it is a preference about this screen rather than about this visit.
 */
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  FlaskConical,
  ChartNoAxesColumn,
  ChevronsUpDown,
  CircleDot,
  FolderOpen,
  LayoutGrid,
  PanelLeft,
  ScrollText,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@insightis/ui/Badge';
import { cn } from '@insightis/ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@insightis/ui/DropdownMenu';
import { Typography } from '@insightis/ui/Typography';
import { hoursOf } from '@/lib/api';
import { PRODUCTS, PRODUCT_IDS, type Product, screensFor } from '@/lib/product';
import { useActivityCount } from '@/features/activity/ActivityView';
import { useAccount } from '@/shell/AccountProvider';
import { chooseProduct, lockedProduct, useProduct } from '@/shell/useProduct';

const TIGHT = 'mouseflow.side.tight';

/* Значок на пункт меню, по маршруту. Единственное, что осталось здесь от прежнего списка: остальное -
 * ярлык, заголовок, бета, счётчик, шаг тура - переехало в product.ts, где у него один экземпляр. */
const ICONS: Record<string, LucideIcon> = {
  '/record': CircleDot,
  '/create': Sparkles,
  '/logs': ScrollText,
  '/skills': FolderOpen,
  '/tests': FlaskConical,
  '/dashboard': ChartNoAxesColumn,
  '/team': Users,
  '/gallery': LayoutGrid,
};

/* One row height, one glyph box, one gap - so a lucide glyph that draws lighter than its neighbours still
 * occupies the same square, and the collapsed rail is a column of identical buttons rather than a stack of
 * whatever each element happened to measure. */
const ROW = 'flex h-9 items-center gap-2.5 rounded-md';
const SQUARE = 'grid size-9 shrink-0 place-items-center rounded-md';
const GLYPH = 'size-[18px] shrink-0';

interface Props {
  onOpenSettings: (screen?: 'account' | 'connections' | 'hours') => void;
}

export const AppSidebar = ({ onOpenSettings }: Props) => {
  const [tight, setTight] = useState(() => {
    try {
      return localStorage.getItem(TIGHT) === '1';
    } catch (_) {
      return false;
    }
  });
  /* Идущее и ждущее прямо сейчас - из того же опроса, что кормит страницу Activity. */
  const liveCount = useActivityCount();
  const { account, runs } = useAccount();
  const path = useRouterState({ select: (s) => s.location.pathname });
  /* `product` - чему подчиняется меню сейчас (адрес сильнее выбора), `chosen` - что отмечено галочкой в
   * переключателе. Разные вещи: на общем экране адрес ничего не говорит, и галочка обязана остаться там,
   * куда её поставили. */
  const { product, chosen } = useProduct();
  const navigate = useNavigate();
  const nav = screensFor(product);
  /* В сборке на один продукт переключателя нет: кнопка, предлагающая половину, которой в этой сборке
   * не существует, - хуже её отсутствия. Знак при этом остаётся и ведёт домой, как вёл до всего этого. */
  const locked = lockedProduct() !== null;

  const toggle = useCallback((next: boolean) => {
    setTight(next);
    try {
      localStorage.setItem(TIGHT, next ? '1' : '0');
    } catch (_) { /* private mode */ }
  }, []);

  // Below this a 236px sidebar and a two-column view do not fit at once; the rail is the honest answer.
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 820px)');
    const apply = () => { if (narrow.matches) setTight(true); };
    apply();
    narrow.addEventListener('change', apply);
    return () => narrow.removeEventListener('change', apply);
  }, []);

  const hours = runs.reduce((sum, run) => sum + hoursOf(run), 0);
  const name = account?.name ?? account?.email ?? 'Signed in';
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <aside
      data-tight={tight ? 'true' : 'false'}
      className={cn(
        'sticky top-0 z-30 flex h-screen shrink-0 flex-col self-start',
        'border-stroke border-r bg-surface-card2 transition-[width] duration-150',
        tight ? 'w-14 items-center px-2 py-3' : 'w-[236px] px-2.5 py-3',
      )}
    >
      <div className={cn('mb-1 flex items-center gap-1 pb-1', tight ? 'justify-center' : 'ps-2.5')}>
        {/* ЗНАК И ПЕРЕКЛЮЧАТЕЛЬ - ОДНА КНОПКА, а не знак плюс что-то рядом.
          *
          * Имя продукта стоит там, где раньше стояло слово MouseFlow, потому что это и есть ответ на
          * вопрос «где я»: два продукта живут в одном приложении, и человек, открывший его, должен
          * видеть, в котором. Знак остаётся слева и по-прежнему ведёт домой - но домой ТОГО продукта,
          * который выбран, а не на постоянный /record.
          *
          * Свёрнутой полосой остаётся только знак: имя в четырнадцать пикселей не помещается, а
          * переключатель, у которого не видно, что выбрано, хуже его отсутствия. */}
        {locked ? (
          <Link
            to={PRODUCTS[chosen].home}
            title={PRODUCTS[chosen].name}
            className={cn(
              'flex min-w-0 items-center gap-2.5 rounded-md text-ink-primary hover:bg-state-hover',
              tight ? 'size-9 justify-center' : 'h-9 px-2.5',
            )}
          >
            <svg viewBox="0 0 24 24" aria-hidden className={cn(GLYPH, 'text-logo-mark')}>
              <path d="M5 4l14 8-6 1.6L10.5 20z" fill="currentColor" />
            </svg>
            {!tight && (
              <Typography variant="span" weight="semibold" className="truncate text-[0.92rem]">
                {PRODUCTS[chosen].name}
              </Typography>
            )}
          </Link>
        ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              /* Первый шаг тура целится сюда. Значение - не маршрут, потому что это и не маршрут: у
               * переключателя нет своего адреса, а подсветка меряет элемент, а не ссылку. */
              data-tour="product"
              title={'Two products in one app: ' + PRODUCTS[chosen].name + '. Click to switch.'}
              className={cn(
                'flex min-w-0 items-center gap-2.5 rounded-md text-ink-primary hover:bg-state-hover',
                tight ? 'size-9 justify-center' : 'h-9 px-2.5 py-0',
              )}
            >
              <svg viewBox="0 0 24 24" aria-hidden className={cn(GLYPH, 'text-logo-mark')}>
                {/* Centred on 12,12. It used to span y 3..19 in a 24 box - a whole unit high - which is
                    invisible on its own and obvious in the extension's rail beside four centred glyphs. */}
                <path d="M5 4l14 8-6 1.6L10.5 20z" fill="currentColor" />
              </svg>
              {!tight && (
                <>
                  <Typography variant="span" weight="semibold" className="truncate text-[0.92rem]">
                    {PRODUCTS[chosen].name}
                  </Typography>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-ink-inactive" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[17rem]">
            <DropdownMenuRadioGroup
              value={chosen}
              onValueChange={(next) => {
                const id = next as Product;
                chooseProduct(id);
                /* И сразу домой выбранного продукта. Без этого переключение с экрана, принадлежащего
                 * другой половине, не меняло бы ничего видимого: адрес сильнее выбора, так что меню
                 * осталось бы прежним, и кнопка читалась бы как сломанная. */
                void navigate({ to: PRODUCTS[id].home });
              }}
            >
              {PRODUCT_IDS.map((id) => (
                <DropdownMenuRadioItem key={id} value={id} className="py-2">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold text-ink-primary">{PRODUCTS[id].name}</span>
                    <span className="text-[0.78rem] text-ink-inactive">{PRODUCTS[id].blurb}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        )}

        {!tight && (
          <button
            type="button"
            onClick={() => toggle(true)}
            title="Collapse the sidebar"
            aria-label="Collapse the sidebar"
            className={cn(SQUARE, 'ms-auto text-ink-inactive hover:bg-state-hover hover:text-ink-primary')}
          >
            <PanelLeft className={GLYPH} />
          </button>
        )}
      </div>

      {tight && (
        <button
          type="button"
          onClick={() => toggle(false)}
          title="Show the sidebar"
          aria-label="Show the sidebar"
          className={cn(SQUARE, 'mb-0.5 text-ink-inactive hover:bg-state-hover hover:text-ink-primary')}
        >
          <PanelLeft className={GLYPH} />
        </button>
      )}

      <nav className={cn('flex shrink-0 flex-col gap-0.5', tight && 'items-center')}>
        {nav.map((row) => {
          const { to, label } = row;
          const Icon = ICONS[to] ?? LayoutGrid;
          const on = path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              title={label}
              /* What the first-run tour points at. TanStack's Link spreads what it does not consume onto
               * the anchor, so this needs no wrapper element. */
              data-tour={to}
              className={cn(
                ROW,
                'text-[0.92rem] text-ink-body hover:bg-state-hover hover:text-ink-primary',
                on && 'bg-state-pressed font-semibold text-ink-primary',
                tight ? 'w-9 justify-center' : 'w-full px-2.5',
              )}
            >
              <Icon className={cn(GLYPH, on && 'text-brand-primary')} />
              {!tight && (
                <>
                  <span className="truncate">{label}</span>
                  {row.beta && (
                    <Badge variant="attention" size="xs" rounded="full" className="ms-auto shrink-0">
                      Beta
                    </Badge>
                  )}
                  {row.live && liveCount > 0 && (
                    <span className="ms-auto shrink-0 rounded-full bg-brand-primary/12 px-1.5 py-px text-[0.68rem] font-semibold text-brand-primary tabular-nums">
                      {liveCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn(
        'mt-auto flex w-full flex-col gap-0.5 border-stroke border-t pt-2',
        // Collapsed, the account square has to sit in the same column as the nav's; the footer is what
        // decides that, and left to itself it aligned the square to the left edge instead.
        tight && 'items-center',
      )}>
        {/* Their balance row, in hours. Clicking it opens the screen it summarises, as theirs does. */}
        {!tight && account && (
          <button
            type="button"
            onClick={() => onOpenSettings('hours')}
            title="Hours these runs took — wall clock, not time saved"
            className={cn(ROW, 'w-full justify-between px-2.5 hover:bg-state-hover')}
          >
            <span className="font-medium text-[0.688rem] text-ink-secondary">Hours</span>
            <span className="flex items-center gap-1.5 text-[0.688rem] text-ink-primary tabular-nums">
              <Wallet className="size-4 shrink-0 rounded-full bg-state-hover p-[0.1875rem]" />
              {hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)} h
            </span>
          </button>
        )}

        {account && (
          <button
            type="button"
            onClick={() => onOpenSettings('account')}
            title="Your account, connections and hours"
            className={cn(
              ROW,
              'text-left hover:bg-state-hover',
              tight ? 'w-9 justify-center' : 'w-full px-2.5',
            )}
          >
            {/* 18px, like every other glyph in this column: at 22 it sat two pixels wide of them expanded
                and pushed its own label four pixels past the nav's. */}
            <span className="grid size-[18px] shrink-0 place-items-center on-accent rounded-full bg-brand-tertiary font-semibold text-[0.625rem]">
              {initial}
            </span>
            {!tight && (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden leading-[1.15]">
                  <strong className="truncate font-semibold text-[0.84rem] text-ink-primary">{name}</strong>
                  <span className="truncate text-[0.72rem] text-ink-secondary">{account.email}</span>
                </span>
                <ChevronsUpDown className="ms-auto size-4 shrink-0 text-ink-inactive" />
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
};
