/* На каком компьютере - выбор в строке управления Create (владелец, 2026-10-16: «нет возможности выбрать, на
 * каком компе задавать задачу»).
 *
 * ДВА РОДА ВЫБОРА, и подпись говорит, какой. «This computer» - тот, на котором открыта эта вкладка: прогон
 * идёт отсюда, по loopback, и его шаги видны вживую, как всегда. Любая машина аккаунта - работа уходит в
 * очередь (POST /api/queue с `device`), её берёт агент той машины, а шаги приезжают в ленту той же
 * карточкой, что и у работ «by itself». Отдельного экрана для этого нет: Create и Devices дают одну и ту же
 * команду, разными дверями.
 */
import { Check, ChevronDown, Monitor } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@insightis/ui/DropdownMenu';
import { cn } from '@insightis/ui/cn';
import { type Device, machineCannot, machineName, machineOnline } from '@/lib/api';

export const HERE = 'here';

const dot = (tone: 'good' | 'attention' | 'off') => (
  <span className={cn('size-2 shrink-0 rounded-full',
    tone === 'good' ? 'bg-fb-green' : tone === 'attention' ? 'bg-fb-attention' : 'bg-ink-inactive')} />
);

export const MachinePick = ({ value, onChange, machines, hereOnline, disabled }: {
  value: string;
  onChange: (id: string) => void;
  machines: Device[];
  /** Отвечает ли агент этого компьютера по loopback. */
  hereOnline: boolean;
  disabled?: boolean;
}) => {
  const picked = value === HERE ? null : machines.find((m) => m.id === value) ?? null;
  /* Машина без имени и без имени компьютера - «Computer N», а не «This computer»: так называется первый
   * пункт, и две строки с одним именем - это выбор, который нельзя сделать. */
  const nameOf = (m: Device) => machineName(m, `Computer ${machines.indexOf(m) + 1}`);
  const label = picked ? nameOf(picked) : 'This computer';
  const tone = (m: Device) => (m.paused ? 'attention' : machineOnline(m) ? 'good' : 'off') as 'good' | 'attention' | 'off';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Which computer does it"
          className={cn(
            'flex max-w-[14rem] items-center gap-1.5 rounded-md border border-stroke px-2 py-1 text-[0.76rem] text-ink-body',
            'hover:bg-state-hover disabled:opacity-disabled',
          )}
        >
          <Monitor className="size-3.5 shrink-0" />
          {dot(picked ? tone(picked) : hereOnline ? 'good' : 'off')}
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-inactive" />
        </button>
      </DropdownMenuTrigger>
      {/* Вверх: строка управления стоит у нижнего края окна. */}
      <DropdownMenuContent align="start" side="top" className="min-w-[16rem]">
        <DropdownMenuItem onSelect={() => onChange(HERE)} className="py-2">
          <span className="flex w-full items-center gap-2">
            {dot(hereOnline ? 'good' : 'off')}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-ink-primary">This computer</span>
              <span className="text-[0.74rem] text-ink-inactive">
                {hereOnline ? 'runs from this tab, live' : 'its agent is not answering'}
              </span>
            </span>
            {value === HERE && <Check className="size-4 text-brand-primary" />}
          </span>
        </DropdownMenuItem>
        {machines.map((m) => {
          const cannot = machineCannot(m);
          return (
            <DropdownMenuItem key={m.id} onSelect={() => onChange(m.id)} className="py-2">
              <span className="flex w-full items-center gap-2">
                {dot(tone(m))}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink-primary">{nameOf(m)}</span>
                  <span className={cn('text-[0.74rem]', cannot ? 'text-fb-attention' : 'text-ink-inactive')}>
                    {cannot ? cannot.short
                      : m.paused ? 'paused from the account'
                        : machineOnline(m) ? `online${m.platform ? ` · ${m.platform}` : ''}` : 'offline - it waits for it'}
                  </span>
                </span>
                {value === m.id && <Check className="size-4 text-brand-primary" />}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
