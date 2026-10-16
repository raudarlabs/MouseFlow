/* MCP в Hivelink: подключить свой ИИ, чтобы он давал машинам команды так же, как человек на этих экранах.
 *
 * ЗАЧЕМ ЭКРАН, ЕСЛИ ЕСТЬ /mcp (владелец, 2026-10-16: «нужно, чтобы ещё был MCP»). /mcp - публичная страница
 * О ПРОДУКТЕ: её читает тот, у кого аккаунта может не быть, и администратор, которому надо сказать «да». Этот
 * экран - для того, кто уже внутри, и отвечает на три вопроса, которых там нет: какой адрес вставить
 * ИМЕННО для этого продукта (с `?profile=do`, чтобы ИИ не получил инструменты записи, которых здесь нет),
 * какие инструменты он здесь получит, и кто уже подключён - с кнопкой «забрать доступ».
 *
 * ФАКТЫ - ИЗ lib/mcp-facts.ts, как у /mcp: список инструментов сверяется сюитой с сервером в обе стороны.
 * Подключённые клиенты - тем же маршрутом, что в Settings → My account (`/api/oauth?do=grants`).
 */
import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { Said, type SaidNote } from '@/components/Said';
import { CONNECT_WAYS, MCP_TOOLS, PROFILE_TOOLS, TOOL_GROUPS, type ToolGroup, mcpUrlFor } from '@/lib/mcp-facts';
import { Page } from '@/shell/Surface';

const LABEL = 'text-[0.7rem] uppercase tracking-wide text-ink-inactive';
const CARD = 'rounded-xl border-stroke border bg-surface-card p-4';

/** Клиент, которому человек разрешил действовать от своего имени. Форма - как отдаёт api/oauth.js. */
interface Grant { clientId: string; name: string; lastUsed: string | null }

const Address = ({ url }: { url: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border-stroke border bg-surface-card2 p-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-2 py-1 font-mono text-[0.86rem] text-ink-primary">
        {url}
      </code>
      <Button
        size="sm"
        variant={copied ? 'secondary' : 'primary'}
        leftSlot={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch (_) {
            /* Заблокированный буфер обмена бывает, а адрес и так можно выделить. Ошибка про удобство хуже
             * молчания. */
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
};

/* Группы, которые в этом профиле есть. «Чтение» здесь пусто - читающие инструменты принадлежат второму
 * продукту, - и пустая рамка с заголовком «Reading» обещала бы то, чего подключённый ИИ не получит. */
const GROUP_ORDER: ToolGroup[] = ['read', 'machine', 'control'];

export const AiView = () => {
  const url = mcpUrlFor('do');
  const ways = CONNECT_WAYS(url);
  const tools = MCP_TOOLS.filter((tool) => PROFILE_TOOLS.do.includes(tool.name));
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [note, setNote] = useState<SaidNote | null>(null);

  const loadGrants = useCallback(async () => {
    try {
      const res = await fetch('/api/oauth?do=grants', { credentials: 'same-origin' });
      const body = await res.json();
      setGrants(res.ok && body && body.grants ? body.grants : []);
    } catch (_) {
      /* У старого развёртывания такого маршрута нет. Пустой список - честное прочтение «здесь никто не
       * подключён», и блок прячется, а не показывает ошибку о функции, которой никто не пользовался. */
      setGrants([]);
    }
  }, []);

  useEffect(() => { void loadGrants(); }, [loadGrants]);

  return (
    <Page className="flex flex-col gap-4 py-6">
      <div>
        <Typography variant="span" className={cn(LABEL, 'block')}>MCP</Typography>
        <Typography variant="h1" weight="semibold" className="mt-0.5 text-[1.7rem]">
          Let your own AI give the orders
        </Typography>
        <Typography variant="p" className="mt-1 max-w-[76ch] text-ink-inactive text-[0.9rem]">
          Connect Claude, or anything else that speaks MCP, and it can run your skills and goals on your
          computers the way you do here. It goes through the same queue, so every run it asks for shows up
          in Logs with its steps and frames. Nothing reaches into a machine: a computer asks the account for
          work, and only while it is taking work.
        </Typography>
      </div>

      <Said note={note} onDismiss={() => setNote(null)} />

      <section className={CARD}>
        <Typography variant="span" className={cn(LABEL, 'block')}>The address</Typography>
        <Typography variant="h2" weight="semibold" className="mt-0.5 mb-3 text-[1.35rem]">
          Add this to your AI
        </Typography>
        <Address url={url} />
        <Typography variant="p" className="mt-2 max-w-[72ch] text-[0.82rem] text-ink-inactive">
          It ends in <code className="font-mono">?profile=do</code>, so the AI is offered only what Hivelink
          does: running, stopping, checking and scheduling. It signs in with the account you are using now.
        </Typography>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ways.map((way) => (
            <div key={way.id} className="rounded-lg border-stroke/45 border bg-surface-card2 p-3">
              <Typography variant="span" weight="semibold" className="block text-[0.9rem]">{way.label}</Typography>
              <Typography variant="p" className="mt-0.5 text-[0.8rem] text-ink-inactive">{way.lead}</Typography>
              <ol className="mt-2 flex list-decimal flex-col gap-1 ps-4 text-[0.8rem] text-ink-body">
                {way.steps.map((step) => (
                  <li key={step}>
                    {step.startsWith('$ ')
                      ? <code className="break-all font-mono text-[0.76rem] text-ink-primary">{step.slice(2)}</code>
                      : step}
                  </li>
                ))}
              </ol>
              {way.note && (
                <Typography variant="p" className="mt-2 text-[0.76rem] text-ink-inactive">{way.note}</Typography>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={CARD}>
        <Typography variant="span" className={cn(LABEL, 'block')}>
          {grants === null ? 'reading…' : grants.length ? `${grants.length} connected` : 'nothing connected yet'}
        </Typography>
        <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.35rem]">Who can act as you</Typography>
        {grants && grants.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {grants.map((grant) => (
              <li
                key={grant.clientId}
                className="flex items-center gap-3 rounded-lg border-stroke/45 border bg-surface-card2 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <Typography variant="span" weight="semibold" className="block text-[0.88rem]">{grant.name}</Typography>
                  <span className="text-[0.76rem] text-ink-inactive">
                    {grant.lastUsed
                      ? `last used ${new Date(grant.lastUsed).toLocaleString()}`
                      : 'never used since you allowed it'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `/api/oauth?do=grants&client=${encodeURIComponent(grant.clientId)}`,
                        { method: 'DELETE', credentials: 'same-origin' },
                      );
                      if (!res.ok) throw new Error('it could not be taken back');
                      setNote({ text: `${grant.name} can no longer act as you.`, kind: 'good' });
                      void loadGrants();
                    } catch (err) {
                      setNote({ text: err instanceof Error ? err.message : 'could not revoke it', kind: 'bad' });
                    }
                  }}
                >
                  Take it back
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <Typography variant="p" className="mt-2 text-[0.85rem] text-ink-inactive">
            When an AI signs in through the address above, it appears here, and you can take its access back
            at any time.
          </Typography>
        )}
      </section>

      <section className={CARD}>
        <Typography variant="span" className={cn(LABEL, 'block')}>{tools.length} tools</Typography>
        <Typography variant="h2" weight="semibold" className="mt-0.5 text-[1.35rem]">What it gets here</Typography>
        <div className="mt-3 flex flex-col gap-4">
          {GROUP_ORDER.filter((group) => tools.some((tool) => tool.group === group)).map((group) => (
            <div key={group}>
              <Typography variant="span" weight="semibold" className="block text-[0.92rem]">
                {TOOL_GROUPS[group].title}
              </Typography>
              <Typography variant="p" className="mt-0.5 max-w-[72ch] text-[0.8rem] text-ink-inactive">
                {TOOL_GROUPS[group].note}
              </Typography>
              <ul className="mt-2 flex flex-col gap-1.5">
                {tools.filter((tool) => tool.group === group).map((tool) => (
                  <li key={tool.name} className="rounded-lg border-stroke/45 border bg-surface-card2 px-3 py-2">
                    <code className="font-mono text-[0.82rem] text-ink-primary">{tool.name}</code>
                    <Typography variant="p" className="mt-0.5 text-[0.8rem] text-ink-body">{tool.what}</Typography>
                    {tool.args && (
                      <Typography variant="p" className="mt-0.5 font-mono text-[0.74rem] text-ink-inactive">
                        {tool.args}
                      </Typography>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
};
