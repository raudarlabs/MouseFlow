// Probe for "a browser of our own": a dedicated Chrome profile driven over --remote-debugging-pipe.
// Answers, by running, the questions the plan cannot answer by reading:
//   1. does it start with a non-default profile and a pipe (no port anybody on the machine can reach)?
//   2. is navigator.webdriver false (the flag sites use to refuse automated browsers)?
//   3. can we see the page while the person works in another app (unfocused), and while minimised?
//   4. do our clicks and typing land as trusted events - without moving the person's real cursor?
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Run: node agent/probe-browser.mjs  (macOS, Google Chrome installed). Writes into a temp folder, never the repo.
import { tmpdir } from 'node:os';
const here = join(tmpdir(), 'mouseflow-probe-browser');
const profile = join(here, 'mf-profile');
mkdirSync(profile, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const cursor = () => execFileSync('osascript', ['-l', 'JavaScript', '-e',
  'ObjC.import("AppKit"); var p=$.NSEvent.mouseLocation; Math.round(p.x)+","+Math.round(p.y)']).toString().trim();
const front = () => execFileSync('osascript', ['-e',
  'tell application "System Events" to get name of first process whose frontmost is true']).toString().trim();

const results = {};
const before = { cursor: cursor(), front: front() };

const chrome = spawn(CHROME, [
  '--remote-debugging-pipe', '--disable-blink-features=AutomationControlled', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1100,800', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => {});
const toChrome = chrome.stdio[3];
const fromChrome = chrome.stdio[4];

let nextId = 1;
const waiting = new Map();
const events = [];
let buf = '';
fromChrome.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  let at;
  while ((at = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, at));
    buf = buf.slice(at + 1);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } else events.push(msg);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = nextId++;
  waiting.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  toChrome.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE = 'data:text/html,' + encodeURIComponent(`<!doctype html><title>probe</title>
<body style="font:20px sans-serif;padding:40px">
<button id=b style="font-size:24px;padding:20px 40px">Press me</button>
<p>presses: <span id=n>0</span> · trusted: <span id=t>-</span></p>
<input id=i style="font-size:20px;width:400px" placeholder="type here">
<script>
document.getElementById('b').addEventListener('click', (e) => {
  const n = document.getElementById('n'); n.textContent = String(+n.textContent + 1);
  document.getElementById('t').textContent = String(e.isTrusted);
});
</script></body>`);

/* --login: открыть вход Google в этом же профиле, с тем же pipe и теми же флагами, и ждать, пока окно не
 * закроют. Входит ЧЕЛОВЕК, своими руками: это единственное, что пробник проверить не может. Потом повторный
 * запуск показывает, пережил ли вход перезапуск (cookies в профиле). */
if (process.argv.includes('--login')) {
  await send('Target.createTarget', { url: 'https://accounts.google.com/' });
  /* Вкладки - только `page`: getTargets отдаёт и сервис-воркеры, и расширения Chrome, и «7 tabs» при одной
   * открытой вкладке читалось как «открылось семь вкладок». */
  const { targetInfos } = await send('Target.getTargets');
  const tabs = targetInfos.filter((t) => t.type === 'page').length;
  console.log(`${tabs} tab${tabs === 1 ? '' : 's'} open. Sign in by hand, then close the window. Profile: ${profile}`);
  await new Promise((done) => chrome.on('exit', done));
  process.exit(0);
}

try {
  const { product } = await send('Browser.getVersion');
  results.started = product;
  const { targetId } = await send('Target.createTarget', { url: PAGE });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const ev = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.value;
  await sleep(1200);
  results.webdriver = await ev('navigator.webdriver');

  // The person goes back to what they were doing: another app in front.
  await sleep(1500);
  execFileSync('osascript', ['-e', 'tell application "Finder" to activate']);
  await sleep(800);
  results.frontBeforeActions = front();
  const c0 = cursor();

  const box = await ev(`(() => { const r = document.getElementById('b').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId);
  }
  await ev(`document.getElementById('i').focus()`);
  await send('Input.insertText', { text: 'typed while you worked' }, sessionId);
  await sleep(300);
  results.cursorAroundActions = `${c0} -> ${cursor()}`;
  results.frontAfterActions = front();
  results.presses = await ev(`document.getElementById('n').textContent`);
  results.trusted = await ev(`document.getElementById('t').textContent`);
  results.typed = await ev(`document.getElementById('i').value`);

  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(here, 'probe-unfocused.png'), Buffer.from(shot.data, 'base64'));
  results.shotUnfocusedBytes = Buffer.from(shot.data, 'base64').length;

  // Minimised: the window is out of the way entirely.
  const { windowId } = await send('Browser.getWindowForTarget', { targetId });
  await send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  await sleep(1000);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId);
  }
  await sleep(300);
  results.pressesMinimised = await ev(`document.getElementById('n').textContent`);
  try {
    const shot2 = await Promise.race([
      send('Page.captureScreenshot', { format: 'png' }, sessionId),
      sleep(8000).then(() => { throw new Error('timed out after 8 s'); }),
    ]);
    writeFileSync(join(here, 'probe-minimised.png'), Buffer.from(shot2.data, 'base64'));
    results.shotMinimisedBytes = Buffer.from(shot2.data, 'base64').length;
  } catch (err) {
    results.shotMinimised = `failed: ${err.message}`;
  }

  results.cursorBefore = before.cursor;
  results.cursorAfter = cursor();
  results.frontBefore = before.front;
  await send('Browser.close').catch(() => {});
} catch (err) {
  results.error = err.message;
  chrome.kill();
}
await sleep(500);
console.log(JSON.stringify(results, null, 2));
process.exit(0);
