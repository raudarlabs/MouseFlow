/* THE MAIL SCREEN of 07's Ask-first demo: a compose window on mac-studio, drawn the way screens.tsx draws
 * Billing - chrome from ScreenWindow, every part placed in percent of the SCREEN on one full-size layer - so
 * the cursor, the ripples and the lens name the same rectangles at every width.
 *
 * Send sits top-left, Outlook's big Send beside To and Subject: the one control the story is about stays
 * clear of everything that later sits under it, and the cursor can stop visibly short of it.
 *
 * Decorative: it renders inside a <Screen>, which is aria-hidden; the figcaption says what happens.
 */
import type { ReactNode } from 'react';
import { cn } from '@insightis/ui/cn';
import type { CueAttrs } from '../../motion';
import { ScreenWindow, TypeText, rectStyle, type Rect } from '../kit';

/** The compose window's parts, in percent of the screen. */
export const MAIL = {
  window: { x: 5, y: 7, w: 90, h: 86 },
  send: { x: 9.5, y: 19.5, w: 12, h: 20 },
  toLabel: { x: 22.5, y: 19.5, w: 8, h: 8.5 },
  to: { x: 31.5, y: 19.5, w: 59, h: 8.5 },
  subjectLabel: { x: 22.5, y: 31, w: 8, h: 8.5 },
  subject: { x: 31.5, y: 31, w: 59, h: 8.5 },
  rule: { x: 9.5, y: 45.5, w: 81, h: 0 },
  body: { x: 9.5, y: 50, w: 81, h: 17 },
  sign: { x: 9.5, y: 70, w: 30, h: 8 },
  toast: { x: 9.5, y: 80.5, w: 17, h: 8 },
} satisfies Record<string, Rect>;

/** Where the bee clicks into To before it types (the field's left third, not its middle). */
export const TO_CLICK = { x: 40, y: 23.5 };

function At({ rect, className, cues, children }: { rect: Rect; className?: string; cues?: CueAttrs; children?: ReactNode }) {
  return (
    <span className={cn('hl-at', className)} style={rectStyle(rect)} {...cues}>
      {children}
    </span>
  );
}

export interface MailWindowProps {
  /** When To, Subject and the body's two lines start typing (ms on the demo's timeline); without them,
      plain text. */
  typeAt?: { to: number; subject: number; body: number; body2: number };
  /** The "Sent" toast - only after a yes; the caller wraps it in its own phase layer. */
  toast?: ReactNode;
}

export function MailWindow({ typeAt, toast }: MailWindowProps) {
  const M = MAIL;
  return (
    <div className="hl-screen-layer rl-mail">
      <ScreenWindow title="New message — Mail" rect={M.window} />
      <At rect={M.send} className="hl-ui-btn hl-ui-btn--primary rl-ui-send">
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M14.5 1.5 1.5 7l5 2 2 5 6-12.5ZM6.5 9l8-7.5" />
        </svg>
        <span>Send</span>
      </At>
      <At rect={M.toLabel} className="hl-ui-label rl-ui-lbl">
        To
      </At>
      <At rect={M.to} className="hl-ui-field">
        <TypeText text="Bob" at={typeAt?.to} />
      </At>
      <At rect={M.subjectLabel} className="hl-ui-label rl-ui-lbl">
        Subject
      </At>
      <At rect={M.subject} className="hl-ui-field">
        <TypeText text="Q3 total" at={typeAt?.subject} />
      </At>
      <At rect={M.rule} className="rl-ui-rule" />
      {/* Two lines, as a person writes it. The greeting types without a caret of its own, so the editor
          never shows two. */}
      <At rect={M.body} className="rl-ui-body">
        <TypeText as="span" className="rl-ui-line" text="Hi Bob," at={typeAt?.body} caret={false} />
        <TypeText as="span" className="rl-ui-line" text="the Q3 total is 48,210.00." at={typeAt?.body2} />
      </At>
      <At rect={M.sign} className="hl-ui-sketch">
        <i style={{ width: '62%' }} />
        <i style={{ width: '88%' }} />
        <i style={{ width: '46%' }} />
      </At>
      {toast}
    </div>
  );
}

/** The toast Mail shows once the message has gone - what the check reads. */
export function SentToast({ cues }: { cues?: CueAttrs }) {
  return (
    <At rect={MAIL.toast} className="hl-ui-toast" cues={cues}>
      <i />
      Sent
    </At>
  );
}
