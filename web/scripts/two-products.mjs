/* Обе половины рядом, чтобы их можно было ПОСМОТРЕТЬ, а не обсуждать по описанию.
 *
 *   node scripts/two-products.mjs build     собирает dist-do и dist-make
 *   node scripts/two-products.mjs serve     поднимает обе на 4410 и 4411 с поддельным API
 *
 * Это уровень 2 из docs/SPLIT-PLAN.md §0 - две сборки из одного репозитория, - и план говорил его
 * подготовить, а не делать: второй домен, второй проект на Vercel и разрезанный `api/` сюда не входят.
 * Здесь ровно то, ради чего его стоило подготовить заранее: два приложения, каждое со своей половиной
 * меню и без переключателя, открываемые рядом в двух окнах.
 *
 * СКРИПТ, А НЕ ПРЕФИКС ПЕРЕМЕННОЙ ОКРУЖЕНИЯ - по той же причине, по которой существует dev-mock.mjs: в
 * PowerShell нет `VITE_PRODUCT=do npm run build`, и одна и та же команда обязана работать из обеих
 * оболочек. И Vite вызывается своим API, а не через bin: Vite 7 больше не отдаёт его подпутём.
 *
 * `serve` поднимает ДВА DEV-СЕРВЕРА, а не раздаёт собранное. Разница существенная: собранное приложение
 * без API показывает свои экраны отказа, то есть сравнивать пришлось бы две страницы с ошибками. С
 * MOCK_API=1 обе половины наполнены теми же поддельными данными, что `npm run dev:mock`, - и видно
 * именно то, ради чего это затевалось: чем меню, заголовки и первый тур одной половины отличаются от
 * другой.
 */
const WHAT = (process.argv[2] || '').trim();
const HALVES = [
  { id: 'do', port: 4410 },
  { id: 'make', port: 4411 },
];

if (WHAT !== 'build' && WHAT !== 'serve') {
  console.error('usage: node scripts/two-products.mjs build|serve');
  process.exit(2);
}

/* ПО ОДНОЙ ЗА РАЗ, а не обе в одном процессе: `VITE_PRODUCT` читается в vite.config.ts на загрузке
 * модуля, и конфиг кэшируется - вторая половина собралась бы с настройками первой и вышла бы её копией
 * под другим именем. Отдельный процесс - единственный способ, при котором обе сборки настоящие. */
if (WHAT === 'build') {
  const { spawnSync } = await import('node:child_process');
  for (const half of HALVES) {
    console.log('\n=== building ' + half.id + ' -> dist-' + half.id + '\n');
    const done = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, VITE_PRODUCT: half.id },
    });
    if (done.status !== 0) process.exit(done.status ?? 1);
  }
  console.log('\nboth built. Look at them with: node scripts/two-products.mjs serve');
} else {
  /* Здесь наоборот - один процесс на оба сервера, и это можно: dev-сервер получает конфиг объектом,
   * а не читает файл, поэтому обе половины настраиваются независимо. */
  process.env.MOCK_API = '1';
  const { createServer } = await import('vite');
  for (const half of HALVES) {
    process.env.VITE_PRODUCT = half.id;
    const server = await createServer({
      configFile: 'vite.config.ts',
      server: { port: half.port, strictPort: true },
      define: { __PRODUCT__: JSON.stringify(half.id) },
    });
    await server.listen();
    console.log('\n' + half.id + ':');
    server.printUrls();
  }
  console.log('\nBoth halves are up. Open them in two windows side by side.');
}
