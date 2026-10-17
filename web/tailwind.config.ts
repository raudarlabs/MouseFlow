/* Their tailwind config, consumed as a preset rather than transcribed.
 *
 * This file used to be a line-for-line copy of vendor/insightis-ui/tailwind.config.ts - every shadow, every
 * keyframe, the `pressed:` variant - which meant a token added upstream silently did not exist here until
 * somebody noticed and copied it across. As a preset there is nothing to keep in step.
 *
 * All that is left is what is genuinely ours: where the classes are, which now includes the vendored tree,
 * because a component's classes have to be in the content globs or Tailwind never emits them - the
 * typefaces, and one missing opacity step.
 *
 * THE TYPEFACES are Hivelink's, the same three the landing uses (owner, 2026-10-16): Manrope for the
 * interface, Sora for headings, JetBrains Mono for labels and code. The preset names DM Sans as `sans`;
 * a key set in this file's `extend` replaces the preset's array for the same key rather than merging into
 * it, so every vendored component that never names a font - which is all of them - follows without being
 * edited, and `npm run sync:ui:check` still sees an untouched vendor tree. index.html loads the files.
 */
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import designSystem from './vendor/insightis-ui/tailwind.config';

const config: Config = {
  presets: [designSystem],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './vendor/insightis-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /* A 12% TINT, which the app writes a dozen times - `bg-fb-green/12` for the "ok" chip,
       * `bg-brand-primary/12` for counts and the accent chip - and which Tailwind 3 silently drops: its
       * opacity scale goes 10, 15, and a modifier off the scale emits no rule at all. So those chips had a
       * coloured word and no chip. One step added here, rather than a dozen `/[0.12]`, because the dozen are
       * already written. */
      opacity: {
        12: '0.12',
      },
      fontFamily: {
        sans: ['Manrope', ...defaultTheme.fontFamily.sans],
        /* `font-display` - page titles and the wordmark. globals.css gives it to every h1 and h2. */
        display: ['Sora', ...defaultTheme.fontFamily.sans],
        /* Cascadia Mono and Consolas before the generic stack, as the old `code` rule had them: on Windows
         * the fallback for a missing web font should still be a monospace somebody chose. */
        mono: [
          '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', '"Cascadia Mono"', 'Consolas', 'monospace',
        ],
      },
    },
  },
};

export default config;
