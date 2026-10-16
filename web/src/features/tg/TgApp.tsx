/* Hivelink в Telegram - мини-приложение под кнопкой меню бота (2026-10-16).
 *
 * ЧТО ЗДЕСЬ: машины аккаунта со статусом, команда словами выбранной машине (или любой свободной), и
 * последние работы - что идёт, чем кончилось, Stop у идущей. Ровно то, что нужно с телефона; всё остальное
 * - в приложении.
 *
 * БЕЗ ВХОДА И БЕЗ ОБСТАНОВКИ. Внутри телеграма куки сайта нет, поэтому страница не спрашивает сессию вовсе:
 * каждый запрос несёт initData, который подписал телеграм, а сервер проверяет подпись и находит аккаунт по
 * спаренному чату (api/_tg-app.mjs, miniApp в api/telegram.js). Открытая в обычном браузере, страница так и
 * говорит: откройте это из бота.
 *
 * ЦВЕТА - ТЕЛЕГРАМА. Мини-приложение живёт внутри чужого окна, и тема телеграма у человека своя; поэтому
 * фон и текст берутся из его themeParams, а не из темы приложения.
 */
import { useCallback, useEffect, useState } from 'react';

interface TgMachine { id: string; name: string; platform: string | null; online: boolean; paused: boolean; cannot: string | null }
interface TgJob { id: string; state: string; ok: boolean | null; said: string | null; what: string; machine: string | null; at: string | null }
interface TgState { ok: true; you: { name: string | null }; chosen: string | null; machines: TgMachine[]; jobs: TgJob[] }

interface TgWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  themeParams: Record<string, string | undefined>;
  HapticFeedback?: { notificationOccurred: (kind: 'success' | 'error') => void };
}
declare global { interface Window { Telegram?: { WebApp?: TgWebApp } } }

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js';
const POLL_MS = 8000;

/* Скрипт телеграма - только на этой странице: остальному приложению он не нужен. */
const loadTelegram = () => new Promise<TgWebApp | null>((done) => {
  if (window.Telegram?.WebApp) { done(window.Telegram.WebApp); return; }
  const tag = document.createElement('script');
  tag.src = SCRIPT;
  tag.onload = () => done(window.Telegram?.WebApp ?? null);
  tag.onerror = () => done(null);
  document.head.appendChild(tag);
});

const call = async (initData: string, body: Record<string, unknown>) => {
  const res = await fetch('/api/telegram?app=1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData, ...body }),
  });
  const answer = await res.json().catch(() => null);
  if (!answer || answer.ok !== true) throw new Error((answer && answer.why) || `HTTP ${res.status}`);
  return answer;
};

const when = (iso: string | null) => {
  if (!iso) return '';
  const at = new Date(iso);
  return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const TgApp = () => {
  const [tg, setTg] = useState<TgWebApp | null | undefined>(undefined);
  const [state, setState] = useState<TgState | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ text: string; good: boolean } | null>(null);

  useEffect(() => {
    void loadTelegram().then((app) => {
      if (app) { app.ready(); app.expand(); }
      setTg(app);
    });
  }, []);

  const load = useCallback(async () => {
    if (!tg || !tg.initData) return;
    try {
      const answer = await call(tg.initData, { action: 'state' }) as TgState;
      setState(answer);
      setWhy(null);
      setTarget((was) => (was === '' && answer.chosen ? answer.chosen : was));
    } catch (err) {
      setWhy(err instanceof Error ? err.message : 'it could not be read');
    }
  }, [tg]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const theme = tg?.themeParams ?? {};
  const bg = theme.bg_color || '#0f172a';
  const text = theme.text_color || '#e5e7eb';
  const hint = theme.hint_color || '#94a3b8';
  const card = theme.secondary_bg_color || 'rgba(148,163,184,0.08)';
  const button = theme.button_color || '#a3e635';
  const buttonText = theme.button_text_color || '#0f172a';

  const send = async () => {
    if (!tg || !goal.trim()) return;
    setBusy(true);
    setSaid(null);
    try {
      await call(tg.initData, { action: 'send', goal: goal.trim(), device: target || null });
      setGoal('');
      const name = state?.machines.find((m) => m.id === target)?.name;
      setSaid({ text: `Sent${name ? ` to ${name}` : ' to the first free computer'}. The result comes to the chat.`, good: true });
      tg.HapticFeedback?.notificationOccurred('success');
      void load();
    } catch (err) {
      setSaid({ text: err instanceof Error ? err.message : 'it was not sent', good: false });
      tg.HapticFeedback?.notificationOccurred('error');
    } finally {
      setBusy(false);
    }
  };

  const stop = async (id: string) => {
    if (!tg) return;
    try { await call(tg.initData, { action: 'stop', id }); void load(); } catch (_) { /* the list says what is true */ }
  };

  const box = { background: card, borderRadius: 14, padding: '12px 14px' } as const;

  return (
    <div style={{ background: bg, color: text, minHeight: '100vh', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Hivelink</div>
      <div style={{ color: hint, fontSize: 13, marginTop: 2 }}>
        {state?.you.name ? `${state.you.name}'s computers` : 'Your computers'}
      </div>

      {tg === null || (tg && !tg.initData) ? (
        <div style={{ ...box, marginTop: 16, fontSize: 14 }}>
          Open this from the Hivelink bot in Telegram — the menu button under the chat.
        </div>
      ) : null}
      {why && <div style={{ ...box, marginTop: 16, fontSize: 14 }}>{why}</div>}

      {state && (
        <>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.machines.length === 0 && (
              <div style={{ ...box, fontSize: 14 }}>
                No computer is attached yet. In Hivelink, Devices → Add machines gives a code and one line to run on each computer.
              </div>
            )}
            {state.machines.map((m) => {
              const picked = target === m.id;
              const dot = m.paused ? '#f59e0b' : m.online ? '#22c55e' : hint;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTarget(picked ? '' : m.id)}
                  style={{ ...box, textAlign: 'left', border: `2px solid ${picked ? button : 'transparent'}`, color: text, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, flex: 'none' }} />
                    <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{m.name}</span>
                    <span style={{ color: hint, fontSize: 12 }}>
                      {m.paused ? 'paused' : m.online ? 'online' : 'offline'}{m.platform ? ` · ${m.platform}` : ''}
                    </span>
                  </div>
                  {m.cannot && <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>It {m.cannot}.</div>}
                </button>
              );
            })}
          </div>

          <div style={{ ...box, marginTop: 12 }}>
            <div style={{ color: hint, fontSize: 12, marginBottom: 6 }}>
              {target ? `To ${state.machines.find((m) => m.id === target)?.name}` : 'To the first free computer — tap one above to choose'}
            </div>
            <textarea
              value={goal}
              onChange={(ev) => setGoal(ev.target.value)}
              rows={3}
              placeholder="What should it do — “open the September report and export it as PDF”"
              style={{ width: '100%', boxSizing: 'border-box', background: bg, color: text, border: `1px solid ${hint}55`, borderRadius: 10, padding: 10, fontSize: 15, resize: 'vertical' }}
            />
            <button
              type="button"
              disabled={busy || !goal.trim()}
              onClick={() => void send()}
              style={{ marginTop: 8, width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: button, color: buttonText, fontWeight: 700, fontSize: 15, opacity: busy || !goal.trim() ? 0.6 : 1 }}
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
            {said && <div style={{ marginTop: 8, fontSize: 13, color: said.good ? text : '#f87171' }}>{said.text}</div>}
          </div>

          {state.jobs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: hint, fontSize: 12, marginBottom: 6 }}>Recent</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.jobs.map((j) => {
                  const live = j.state === 'queued' || j.state === 'claimed';
                  const mark = live ? (j.state === 'queued' ? 'waiting' : 'running')
                    : j.state === 'cancelled' ? 'cancelled' : j.ok ? 'done' : 'failed';
                  const color = live ? '#f59e0b' : j.ok ? '#22c55e' : j.state === 'cancelled' ? hint : '#f87171';
                  return (
                    <div key={j.id} style={{ ...box, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color, fontSize: 12, fontWeight: 600, flex: 'none' }}>{mark}</span>
                        <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.what}</span>
                        {live && (
                          <button type="button" onClick={() => void stop(j.id)}
                            style={{ border: `1px solid ${hint}66`, background: 'transparent', color: text, borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
                            Stop
                          </button>
                        )}
                      </div>
                      <div style={{ color: hint, fontSize: 12, marginTop: 2 }}>
                        {[j.machine, when(j.at)].filter(Boolean).join(' · ')}
                        {!live && !j.ok && j.said ? ` — ${j.said}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
