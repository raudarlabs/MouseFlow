/* The landing's motion system, in one import: `import { useTimeline, Reveal, cue } from '../motion'`.
 * motion.css (tokens, reveals, cues, loops) is imported once, by landing.css; initMotion() is started once,
 * by Landing's effect. Nothing else needs wiring. */
export { initMotion } from './init';
export { MOTION_QUERY, isStill, motionAllowed, subscribeMotion } from './state';
export { useEnhanced, useInView, useIsoLayoutEffect, usePrefersMotion, type InViewOptions } from './hooks';
export { Reveal, reveal, revealGroup, revealItem, type RevealKind, type RevealProps } from './Reveal';
export { TimelineContext, useTimeline, useTimelineFrame, type Timeline, type TimelineOptions } from './timeline';
export { smoothJump } from './jump';
export { cue, stagger, type CueAttrs, type CueFx } from './cue';
