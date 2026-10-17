/* THE STORY, IN ORDER. After the hero the page follows one test through one week in the hive, and each
 * section answers the question the one before it raises:
 *
 *   01 LiveQa      what does it actually do?            a test in words, run live, judged by the machine
 *   02 Verdicts    why trust that green?                the same test on three nights
 *   03 NightShift  does it run without me?              Nightly, and the 9 a.m. answer       (first CTA)
 *   04 AlwaysOn    and for IT?                          a machine that's always on, and lives there
 *   05 Channels    how do I reach it?                   the app, Claude over MCP, Telegram
 *   06 UseCases    show me real work                    eight run cards                      (second CTA)
 *   07 Rails       is it safe to let it?                the rails, Ask first, what it doesn't do yet
 *   08 Faq         the rest of my questions             straight answers
 *   09 FinalCall   so?                                  the invitation, with the form
 *
 * Prerendered with the hero. A section owns its file and its stylesheet; this list and Landing.tsx are the
 * only places that know the order.
 */
import { AlwaysOn } from './AlwaysOn';
import { Channels } from './Channels';
import { Faq } from './Faq';
import { FinalCall } from './FinalCall';
import { LiveQa } from './LiveQa';
import { NightShift } from './NightShift';
import { Rails } from './Rails';
import { UseCases } from './UseCases';
import { Verdicts } from './Verdicts';

export function StorySections({ endpoint }: { endpoint: string }) {
  return (
    <div className="hl-story">
      <LiveQa />
      <Verdicts />
      <NightShift />
      <AlwaysOn />
      <Channels />
      <UseCases />
      <Rails />
      <Faq />
      <FinalCall endpoint={endpoint} />
    </div>
  );
}
