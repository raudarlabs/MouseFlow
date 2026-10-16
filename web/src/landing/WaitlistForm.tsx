/* The waitlist form: the one thing on the landing that does anything.
 *
 * Built from the design system's own Input and Button, in a glass field the landing draws around them -
 * the same button the admin presses, at the landing's size. Rendered on the server like the rest of the
 * page (so it is in view-source and works for a crawler's eyes), and live once the client hydrates.
 *
 * WHAT THE VISITOR IS TOLD, and when. The status line under the field is an aria-live region that always
 * exists - a live region added at the moment it has something to say is often not announced at all - and
 * it says the reassurance at rest, the problem when there is one, and the outcome the SERVER gave. The
 * outcomes are waitlist.ts's; nothing here decides a sign-up worked.
 *
 * method="post" with no action, for the moment before hydration: a GET would put the address in the URL,
 * in the history and in a referrer, and this way an early press goes nowhere rather than leaking.
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { Input } from '@insightis/ui/Input';
import { cn } from '@insightis/ui/cn';
import { joinWaitlist, looksLikeEmail, refSummary, type WaitlistOutcome } from './waitlist';

type Status = 'idle' | 'invalid' | 'sending' | WaitlistOutcome;

const NOTE: Record<Status, string> = {
  idle: 'One email when the hive opens. No spam, ever.',
  invalid: 'Please enter a valid email address.',
  sending: 'Adding you to the waitlist…',
  ok: 'You’re in the hive. We’ll write when early access opens.',
  invalid_email: 'That address didn’t go through. Check it and try again.',
  /* The server allows a handful of tries per network per HOUR (api/_waitlist.mjs, TRIES), so "a minute"
   * would send the visitor straight back into the same 429. Its Retry-After is not readable cross-origin
   * (not a CORS-safelisted header, and the route does not expose it), so no exact time is promised. */
  rate_limited: 'Too many tries from this network. Please try again in an hour or so.',
  failed: 'We couldn’t reach the waitlist just now. Your address was not saved — please try again in a moment.',
};

export interface WaitlistFormProps {
  endpoint: string;
  className?: string;
}

export function WaitlistForm({ endpoint, className }: WaitlistFormProps) {
  const uid = useId();
  const emailId = 'email';
  const noteId = 'waitlist-note' + uid.replace(/[^A-Za-z0-9_-]/g, '');
  const [status, setStatus] = useState<Status>('idle');
  const input = useRef<HTMLInputElement>(null);
  const honey = useRef<HTMLInputElement>(null);
  const busy = status === 'sending';
  const problem = status === 'invalid' || status === 'invalid_email';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const email = (input.current?.value ?? '').trim();
    if (!looksLikeEmail(email)) {
      setStatus('invalid');
      input.current?.focus();
      return;
    }
    setStatus('sending');
    const outcome = await joinWaitlist(endpoint, {
      email,
      website: honey.current?.value ?? '',
      ref: refSummary(window.location.search, document.referrer, window.location.hostname),
    });
    setStatus(outcome);
    if (outcome === 'ok' && input.current) input.current.value = '';
    if (outcome === 'invalid_email') input.current?.focus();
  }

  return (
    <form id="waitlist" method="post" noValidate onSubmit={submit} className={cn('w-full max-w-[520px]', className)}>
      <label htmlFor={emailId} className="mb-[9px] ml-1 block text-[13px] font-semibold tracking-[0.01em] text-ink-primary">
        Get early access — join the waitlist
      </label>
      <div className={cn('landing-field', problem && 'landing-field-problem')}>
        <Input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="you@work.com"
          required
          readOnly={busy}
          aria-invalid={problem || undefined}
          aria-describedby={noteId}
          onInput={() => problem && setStatus('idle')}
          className="h-[50px] pl-4 pr-1.5 text-base max-[389px]:pl-[13px] font-medium text-ink-primary placeholder:text-ink-inactive min-[1200px]:h-14 min-[1200px]:pl-5 min-[1200px]:text-[17px]"
          ref={input}
        />
        <Button
          type="submit"
          variant="primary"
          size="xl"
          rounded="full"
          isLoading={busy}
          rightSlot={busy ? null : <ArrowRight aria-hidden strokeWidth={2.2} />}
          className="landing-cta h-[50px] shrink-0 gap-2 pl-5 pr-[18px] font-display text-[15px] font-semibold tracking-[-0.01em] max-[389px]:pl-4 max-[389px]:pr-3.5 max-[389px]:text-[14px] min-[1200px]:h-14 min-[1200px]:pl-[26px] min-[1200px]:pr-6 min-[1200px]:text-base"
        >
          Join the waitlist
        </Button>
      </div>
      {/* The honeypot. Off-screen rather than display:none (some bots skip hidden fields), out of the tab
          order and the accessibility tree, and named like a field a form-filler cannot resist. */}
      <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
        <label htmlFor={'website' + noteId}>Website</label>
        <input id={'website' + noteId} ref={honey} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <p
        id={noteId}
        aria-live="polite"
        role="status"
        className={cn(
          'ml-1 mt-[11px] text-[12.5px] leading-normal',
          /* A failure is red here as it is in the admin; being told to wait is a warning, not a failure. */
          status === 'ok'
            ? 'text-ink-highlight'
            : problem || status === 'failed'
              ? 'text-fb-red-text'
              : status === 'rate_limited'
                ? 'text-fb-attention'
                : 'text-ink-inactive',
        )}
      >
        {NOTE[status]}
      </p>
    </form>
  );
}
