/* The share card and the home-screen icon, drawn with the landing's own parts so they cannot drift from
 * it: the same HiveMark, the same GlassHive, the same faces and tokens. Served by `npm run dev:landing` at
 * /og.html (1200x630) and /og.html?icon (180x180) and screenshotted with headless Chrome; the commands are
 * in landing/README.md. Never built or shipped - only its PNGs are. */
import { createRoot } from 'react-dom/client';
import './landing.css';
import './sections/hero.css';
import { HiveMark } from '@/components/brand/HiveMark';
import { GlassHive } from '@/components/brand/GlassHive';

const icon = new URLSearchParams(location.search).has('icon');

function Card() {
  return (
    <div className="landing relative h-[630px] w-[1200px] overflow-hidden">
      <div className="landing-bg !h-full" aria-hidden="true" />
      <div className="absolute inset-y-0 left-[72px] z-10 flex w-[620px] flex-col justify-center">
        <div className="mb-11 flex items-center gap-3">
          <HiveMark className="size-[46px]" />
          <b className="font-display text-[30px] font-semibold tracking-[-0.03em]">hivelink</b>
        </div>
        <h1 className="landing-h1 !m-0 !text-[76px]">
          <span className="block">Every machine.</span>
          <span className="landing-grad block">One hive.</span>
        </h1>
        <p className="mt-7 max-w-[500px] text-[21px] leading-[1.5] text-ink-body">
          Your hive of AI agents, one bee on each Windows and Mac. Tell the hive what to do in plain words.
        </p>
        <p className="landing-soon mt-9 !text-[14px]">
          <i aria-hidden="true" className="landing-dot" />
          Coming soon · Early access
        </p>
      </div>
      <GlassHive className="absolute right-[-80px] top-[52px] h-[560px] w-[760px]" tags={false} />
    </div>
  );
}

function Icon() {
  return (
    <div className="grid size-[180px] place-items-center bg-surface-page">
      <HiveMark className="size-[150px]" />
    </div>
  );
}

document.documentElement.style.background = 'hsl(var(--surface-page))';
createRoot(document.getElementById('root')!).render(icon ? <Icon /> : <Card />);
