/* THE SECTION SHELL - one container, one seam, one head, one stage for every story section, so the page
 * reads as one product told in nine steps rather than nine pages stacked up.
 *
 *   <Section id="qa" index="01" label="How it tests"
 *            title={<>Write the test in words. <Grad>Watch a live agent run it.</Grad></>}
 *            lead="Not a recorder and not a script. …" head="split" pool="right"
 *            foot={<ArrowLink href="#proof">Why you can trust the green</ArrowLink>}>
 *     …the stage…
 *   </Section>
 *
 * renders <section id aria-labelledby="<id>-title" class="hl-sec"> › .hl-wrap › seam, SectionHead, .hl-stage,
 * .hl-foot. The head reveals itself (eyebrow, H2, lead at 0 / 70 / 140ms); the stage's own reveals start
 * at 210ms (.hl-stage sets --i-base: 3). data-loop lets the motion system pause the ambient loops inside
 * while the section is off screen.
 *
 * head="none" leaves the head to the section - FinalCall puts its centred head inside its panel, under its
 * art - and then the section renders <SectionHead id={id} …/> itself, so aria-labelledby still resolves.
 */
import type { ReactNode } from 'react';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { reveal, smoothJump } from '../../motion';
import './kit.css';

export type HeadLayout = 'split' | 'stack' | 'center' | 'none';
export type PoolSide = 'left' | 'right' | 'center' | 'honey' | 'none';

export interface SectionHeadProps {
  /** The section's id: the H2 gets id="<id>-title". */
  id: string;
  /** Two digits, "01". */
  index: string;
  /** The eyebrow's words, "How it tests". */
  label: string;
  /** The H2. Wrap its second clause in <Grad>. */
  title: ReactNode;
  lead?: ReactNode;
  layout?: Exclude<HeadLayout, 'none'>;
  className?: string;
}

/** The second clause of a heading, in the hero's frost → ice gradient: every H2 rhymes with "One hive.". */
export const Grad = ({ children }: { children: ReactNode }) => <span className="landing-grad">{children}</span>;

export function SectionHead({ id, index, label, title, lead, layout = 'split', className }: SectionHeadProps) {
  return (
    <header className={cn('hl-head', `hl-head--${layout}`, className)}>
      <p className="hl-eyebrow" {...reveal('up', 0)}>
        <i className="hl-eyebrow-tick" aria-hidden="true" />
        <span className="hl-eyebrow-num">{index}</span>
        <i className="hl-eyebrow-hex" aria-hidden="true" />
        <span>{label}</span>
      </p>
      <Typography variant="h2" id={`${id}-title`} className="hl-h2" {...reveal('up', 1)}>
        {title}
      </Typography>
      {lead && (
        <Typography className="hl-lead" {...reveal('up', 2)}>
          {lead}
        </Typography>
      )}
    </header>
  );
}

export interface SectionProps extends Omit<SectionHeadProps, 'layout' | 'className'> {
  head?: HeadLayout;
  /** The static light pool behind the main visual: 01 right · 02 left · 03 right · 04 left · 05 right ·
      06 center · 07 left · 08 none · 09 honey. */
  pool?: PoolSide;
  /** The seam's hex node: honey in 03 and 09 only. */
  seam?: 'ice' | 'honey';
  /** Under the stage: an ArrowLink or a JoinCta. */
  foot?: ReactNode;
  className?: string;
  stageClassName?: string;
  children?: ReactNode;
}

export function Section({ id, index, label, title, lead, head = 'split', pool = 'none', seam = 'ice', foot, className, stageClassName, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('hl-sec', `hl-sec--${head}`, className)} data-loop="">
      {pool !== 'none' && <div className={`hl-pool hl-pool--${pool}`} aria-hidden="true" />}
      <div className="hl-wrap">
        <span className={cn('hl-seam', seam === 'honey' && 'hl-seam--honey')} aria-hidden="true" />
        {head !== 'none' && <SectionHead id={id} index={index} label={label} title={title} lead={lead} layout={head} />}
        <div className={cn('hl-stage', stageClassName)}>{children}</div>
        {foot && <div className="hl-foot">{foot}</div>}
      </div>
    </section>
  );
}

/** A quiet text link with an arrow that nudges 3px on hover - a section's foot link. In-page targets
    glide there under html.motion and jump otherwise. */
export function ArrowLink({ href, children, arrow = '→', className }: { href: string; children: ReactNode; arrow?: string; className?: string }) {
  return (
    <a href={href} onClick={href.startsWith('#') ? smoothJump : undefined} className={cn('hl-link', className)}>
      {children}
      <span className="hl-link-arrow" aria-hidden="true">
        {arrow}
      </span>
    </a>
  );
}
