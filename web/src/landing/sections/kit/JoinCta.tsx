/* A section's call to action: the honey primary, as a LINK to the waitlist. Only the hero's form, 03's CTA,
 * 06's CTA and 09's form are honey buttons on this page; nothing else is.
 *
 * href="#join" so that without a script it lands on the final form; with one, callWaitlist brings the right
 * form to the middle of the screen and puts the cursor in it (see call-waitlist.ts). The vendored Button's
 * look on an <a> (buttonVariants), not <Button asChild> - the Button wraps its label between two slots and
 * Radix's Slot takes one child.
 */
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@insightis/ui/Button';
import { cn } from '@insightis/ui/cn';
import { callWaitlist } from '../../call-waitlist';

export interface JoinCtaProps {
  label?: string;
  note?: string;
  className?: string;
}

export function JoinCta({ label = 'Join the hive', note, className }: JoinCtaProps) {
  return (
    <div className={cn('hl-cta', className)}>
      <a
        href="#join"
        onClick={callWaitlist}
        className={buttonVariants({ variant: 'primary', size: 'xl', rounded: 'full', fullWidth: true, className: 'hl-cta-btn landing-shine' })}
      >
        {label}
        <ArrowRight aria-hidden strokeWidth={2.2} />
      </a>
      {note && <p className="hl-cta-note">{note}</p>}
    </div>
  );
}
