/* qa-vm-1's SCREEN - the Windows 11 desktop the bee drives in 01: the in-house Billing app (the kit's shared
 * window, the one 02 keeps as frames), a taskbar with the agent's tray glyph, and the overlays that make a
 * live agent visible - the honey border lit while it drives, the cursor, its clicks, the focus moving field
 * to field as it types, and the lens closing on each control a check reads.
 *
 * WHY A TASKBAR. The side pane is taller than a 16:10 screen beside it, and the kit stretches a split
 * screen to the pane's height. Stretching the window itself would pull its fields apart, so the window sits
 * in a 16:10 box centred in the desktop area and the taskbar takes the bottom - a stretched screen reads as
 * more desktop, not as a distorted app. Stacked (under 1024) the screen is 16:11: the 16:10 box plus the
 * taskbar, exactly.
 *
 * Every coordinate is percent of that 16:10 box (BILLING's rectangles), so the cursor clicks where the
 * button is drawn at every width. The screen is a picture: the kit renders it aria-hidden, and the
 * figcaption says what it shows.
 */
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';
import { BILLING, BeeCursor, BillingWindow, DriveBorder, HexDot, Lens, Ripple, Screen, TypeText, centre, rectStyle, type Rect } from '../kit';
import { J, R, W } from './script';

/** The invoice list the app shows before "New invoice" is pressed: drawn rows, no words to read. */
const ROWS = [0, 1, 2, 3];

function InvoiceList() {
  return (
    <span className="hl-screen-layer lqa-list hl-transient" {...cue(0, 'none', R.form)}>
      <span className="hl-at hl-ui-label" style={rectStyle({ x: 10, y: 33, w: 20, h: 4 })}>
        Invoices
      </span>
      {ROWS.map((r) => (
        <span key={r} className="hl-at lqa-list-row" style={rectStyle({ x: 10, y: 40 + r * 11, w: 80, h: 8 })}>
          <i style={{ width: '14%' }} />
          <i style={{ width: '30%' }} />
          <i style={{ width: '12%', marginLeft: 'auto' }} />
        </span>
      ))}
    </span>
  );
}

/** A field taking the keyboard while the bee types into it: an ice-2 ring, transient. */
function Focus({ rect, at, out }: { rect: Rect; at: number; out: number }) {
  return <span className="hl-at lqa-focus hl-transient" style={rectStyle(rect)} {...cue(at, 'none', out)} />;
}

/** Windows 11's taskbar, drawn: centred app slots (Billing's is the open one) and, in the tray, the agent's
    own glyph - ice while it waits for work, honey while it drives. */
function Taskbar() {
  return (
    <span className="lqa-taskbar">
      <span className="lqa-taskbar-apps">
        <i />
        <i />
        <i className="is-open" />
        <i />
        <i />
      </span>
      <span className="lqa-tray">
        <HexDot kind="ice" size={8} />
        <span className="lqa-tray-live hl-transient" {...cue(R.start, 'none', J.start)}>
          <HexDot kind="honey" size={8} />
        </span>
      </span>
    </span>
  );
}

export function Desk({ className }: { className?: string }) {
  const B = BILLING;
  const rest = { x: 62, y: 74 };
  const away = { x: 90, y: 96 };
  return (
    <Screen className={cn('lqa-screen', className)}>
      <span className="lqa-desk">
        <span className="lqa-view">
          <span className="lqa-app">
            <BillingWindow
              customer={<TypeText text="ACME" at={R.customer.type} speed="bee" />}
              hours={<TypeText text="4" at={R.hours.type} speed="bee" />}
              rate={<TypeText text="310" at={R.rate.type} speed="bee" />}
              total={<span {...cue(R.total)}>1,240.00</span>}
              cues={{
                form: { ...cue(R.form), className: 'lqa-form' },
                toast: { ...cue(R.toast.at, 'rise-lg', R.toast.out), className: 'hl-transient' },
              }}
            />
            <InvoiceList />
          </span>
          <Focus rect={B.customer} at={R.customer.focus} out={R.customer.blur} />
          <Focus rect={B.hours} at={R.hours.focus} out={R.hours.blur} />
          <Focus rect={B.rate} at={R.rate.focus} out={R.rate.blur} />
          <Ripple at={R.toNew + 560} {...centre(B.newInvoice)} />
          <Ripple at={R.customer.focus} {...centre(B.customer)} />
          <Ripple at={R.toSave + 560} {...centre(B.save)} />
          <Lens rect={B.total} className="lqa-lens-end" tag="Edit “Total” · tree" at={R.check1.at} resolveAt={R.check1.resolve} out={R.check1.out} />
          <Lens rect={B.toast} tag="Text “Invoice saved” · tree" at={R.check2.lens} resolveAt={R.check2.resolve} out={R.check2.out} />
          <BeeCursor
            path={[
              { at: R.cursorIn, ...rest },
              { at: R.toNew, ...centre(B.newInvoice) },
              { at: R.toCustomer, x: B.customer.x + 9, y: B.customer.y + B.customer.h / 2 },
              { at: R.toSave, ...centre(B.save) },
              { at: R.cursorAway, ...away },
            ]}
            out={R.cursorOut}
          />
        </span>
      </span>
      <Taskbar />
      <span className="hl-screen-tint" {...cue(W.night)} />
      <DriveBorder at={R.start} out={J.start} />
      <span className="hl-shutter" {...cue(J.shutter, 'none')} />
    </Screen>
  );
}
