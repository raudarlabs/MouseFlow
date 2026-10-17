/* THE SCREENS THE STORY RETURNS TO. The page follows one test - "Invoice total is right" in an in-house
 * Billing app on qa-vm-1 - from 01 (watched live) to 02 (the same screen kept as frames on three nights), so
 * the Billing window is drawn once, here, and both sections place their cursor, ripples and lenses on the
 * same named rectangles.
 *
 * Every part is positioned in percent of the SCREEN (not of the window), on one full-size layer: the window
 * is chrome, its controls sit over it at fixed rectangles, and BILLING names them. A section passes the
 * values (plain text, or a TypeText that types into the field) and any cue attributes a part needs.
 */
import type { ReactNode } from 'react';
import { cn } from '@insightis/ui/cn';
import type { CueAttrs } from '../../motion';
import { ScreenWindow, rectStyle, type Rect } from './Theater';

/** The Billing window's parts, in percent of the screen. */
export const BILLING = {
  window: { x: 6, y: 7, w: 88, h: 86 },
  newInvoice: { x: 10, y: 19, w: 17, h: 8 },
  customerLabel: { x: 10, y: 33, w: 30, h: 4 },
  customer: { x: 10, y: 38, w: 51, h: 9 },
  hoursLabel: { x: 10, y: 52, w: 20, h: 4 },
  hours: { x: 10, y: 57, w: 23, h: 9 },
  rateLabel: { x: 37, y: 52, w: 20, h: 4 },
  rate: { x: 37, y: 57, w: 24, h: 9 },
  totalLabel: { x: 66, y: 52, w: 20, h: 4 },
  total: { x: 66, y: 57, w: 24, h: 9 },
  save: { x: 76, y: 75, w: 14, h: 9 },
  toast: { x: 10, y: 75, w: 30, h: 9 },
  aside: { x: 66, y: 33, w: 24, h: 14 },
  signIn: { x: 31, y: 27, w: 38, h: 50 },
} satisfies Record<string, Rect>;

export type BillingPart = 'form' | 'customer' | 'hours' | 'rate' | 'total' | 'save' | 'toast' | 'signIn';

export interface BillingWindowProps {
  customer?: ReactNode;
  hours?: ReactNode;
  rate?: ReactNode;
  /** The computed total. */
  total?: ReactNode;
  /** Show the "Invoice saved" toast. Default true. */
  toast?: boolean;
  /** Billing asking to sign in, over the form (a password field the bee never types into). */
  signIn?: boolean;
  /** Cue attributes (and a class) for a part: { toast: cue(8300, 'rise', 9100) }. "form" is everything
      under the toolbar, for a form that appears when "New invoice" is pressed. */
  cues?: Partial<Record<BillingPart, CueAttrs & { className?: string }>>;
  className?: string;
}

function Part({ rect, cues, className, children }: { rect: Rect; cues?: CueAttrs & { className?: string }; className?: string; children?: ReactNode }) {
  const { className: cueClass, ...attrs } = cues ?? {};
  return (
    <span className={cn('hl-at', className, cueClass)} style={rectStyle(rect)} {...attrs}>
      {children}
    </span>
  );
}

/** "Billing — New invoice": toolbar, Customer / Hours / Rate / Total, Save, and the toast. Decorative -
    it renders inside a <Screen>, which is aria-hidden. */
export function BillingWindow({
  customer = 'ACME',
  hours = '4',
  rate = '310',
  total = '1,240.00',
  toast = true,
  signIn = false,
  cues = {},
  className,
}: BillingWindowProps) {
  const B = BILLING;
  const { className: formClass, ...formAttrs } = cues.form ?? {};
  return (
    <div className={cn('hl-screen-layer hl-billing', className)}>
      <ScreenWindow title="Billing — New invoice" rect={B.window} />
      <Part rect={B.newInvoice} className="hl-ui-btn">
        New invoice
      </Part>
      <span className={cn('hl-screen-layer', formClass)} {...formAttrs}>
        <Part rect={B.customerLabel} className="hl-ui-label">
          Customer
        </Part>
        <Part rect={B.customer} className="hl-ui-field" cues={cues.customer}>
          {customer}
        </Part>
        <Part rect={B.hoursLabel} className="hl-ui-label">
          Hours
        </Part>
        <Part rect={B.hours} className="hl-ui-field" cues={cues.hours}>
          {hours}
        </Part>
        <Part rect={B.rateLabel} className="hl-ui-label">
          Rate
        </Part>
        <Part rect={B.rate} className="hl-ui-field" cues={cues.rate}>
          {rate}
        </Part>
        <Part rect={B.totalLabel} className="hl-ui-label">
          Total
        </Part>
        <Part rect={B.total} className="hl-ui-field hl-ui-field--strong" cues={cues.total}>
          {total}
        </Part>
        <Part rect={B.aside} className="hl-ui-sketch">
          <i style={{ width: '70%' }} />
          <i style={{ width: '90%' }} />
          <i style={{ width: '55%' }} />
        </Part>
        <Part rect={B.save} className="hl-ui-btn hl-ui-btn--primary" cues={cues.save}>
          Save
        </Part>
        {toast && (
          <Part rect={B.toast} className="hl-ui-toast" cues={cues.toast}>
            <i />
            Invoice saved
          </Part>
        )}
      </span>
      {signIn && (
        <Part rect={B.signIn} className="hl-ui-modal" cues={cues.signIn}>
          <b>Sign in to Billing</b>
          <span className="hl-ui-label">Password</span>
          <span className="hl-ui-field" style={{ height: '18%' }}>
            ••••••••
          </span>
          <span className="hl-ui-btn hl-ui-btn--primary" style={{ height: '18%' }}>
            Sign in
          </span>
        </Part>
      )}
    </div>
  );
}
