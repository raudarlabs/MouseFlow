/* The desktop agents are single files, and the app serves them: the start command pipes one straight from
 * this origin, and the macOS installer curls the other from it. They live at ../agent - one copy each, which
 * the README and the extension also point at - so they are copied into public/ at build time rather than
 * duplicated in the tree.
 *
 * Runs before dev and before build, so the dev server serves the same files the deployment will.
 *
 * A missing file is a failure, not a skip. The whole install path on either platform is "fetch this from the
 * origin", and a deployment that silently shipped without one of them would answer 404 to the only command
 * the Connections screen offers.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const files = [
  'mouseflow-agent.ps1',   // Windows: fetched and run in memory by the one-liner
  'mouseflow-agent.swift', // macOS: fetched and compiled on the machine by the installer
  'install-mac.sh',        // macOS: the installer itself
];

/* ГОТОВЫЕ ПРИЛОЖЕНИЯ ДЛЯ MAC - только нотаризованные. agent/package-mac.sh пишет agent/dist/notarized.txt
 * после того, как Apple приняла и степлер прибил оба образа; без этой метки образы не раздаются, а кнопка
 * Download не рисуется (тот же признак читает web/vite.config.ts). Раздать ненотаризованный образ значило бы
 * дать человеку файл, который macOS на любом другом Mac откажется открыть. */
const NOTARIZED = resolve(here, '../../agent/dist/notarized.txt');
const images = ['dist/MouseFlow-Agent.dmg', 'dist/MouseFlow-Agent-RecordOnly.dmg'];
if (existsSync(NOTARIZED)) {
  for (const name of images) {
    if (!existsSync(resolve(here, '../../agent/', name))) {
      console.error(`agent/${name} is missing while notarized.txt says both were made - rebuild with package-mac.sh`);
      process.exit(1);
    }
  }
  files.push(...images);
} else {
  console.log('no notarised Mac app yet (agent/dist/notarized.txt) - the Download for Mac button stays hidden');
}

for (const name of files) {
  const from = resolve(here, '../../agent/', name);
  const to = resolve(here, '../public/agent/', name.replace(/^dist\//, ''));
  if (!existsSync(from)) {
    console.error(`agent/${name} is missing - the install command for that platform would 404`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

console.log(`agents copied into public/agent (${files.join(', ')})`);
