/* The section kit in one import: `import { Section, Grad, Panel, CheckLine, … } from './kit'`.
 * Every story section builds from these, so the page has one shell, one glass, one status language and one
 * theater. kit.css comes with Section; theater.css with the Theater parts. */
export { ArrowLink, Grad, Section, SectionHead, type HeadLayout, type PoolSide, type SectionHeadProps, type SectionProps } from './Section';
export { Panel, PanelBar, Tile, type PanelProps, type PanelTone, type TileProps } from './Panel';
export {
  HexDot,
  LiveDot,
  NightDots,
  StatusChip,
  TierTag,
  VerdictChip,
  type ChipKind,
  type HexKind,
  type Night,
  type Status,
  type Tier,
  type Verdict,
} from './status';
export { CheckLine, HexSpinner, Lines, LogLine, StepLine, Tick, VerdictBar, type LineMark, type Outcome } from './lines';
export { TYPE_CAP_MS, TYPE_SPEED, TypeText, typeDuration, type TypeSpeed } from './TypeText';
export { DemoFrame, PlayToggle, ReplayButton } from './DemoFrame';
export { CueSwap, type CueSwapValue } from './CueSwap';
export {
  BeeCursor,
  ClockDigits,
  DriveBorder,
  FrozenFrame,
  Lens,
  Ripple,
  Screen,
  ScreenWindow,
  Theater,
  TheaterBar,
  centre,
  rectStyle,
  type ClockValue,
  type Point,
  type Rect,
  type Waypoint,
} from './Theater';
export { BILLING, BillingWindow, type BillingPart } from './screens';
export { JoinCta } from './JoinCta';
