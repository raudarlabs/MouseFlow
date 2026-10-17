/* 04 · FOR IT - the IT side of the same agent, told truthfully: put it on a machine that's always on and it
 * lives there. It moves in with one line and one code, starts at logon, dials out for work, takes commands in
 * plain words for one machine or fifty, and every machine is accounted for.
 *
 * The stage, in reading order:
 *   Devices (./AlwaysOn/Devices.tsx)   one command to four office PCs, answered row by row - the loop
 *   Add machines (./AlwaysOn/Enrol)    the code and the one line, with poll dots that only travel outward
 *   The switch (./AlwaysOn/Switch)     the tray / menu-bar switch the reader can flip; the account can't
 *   Points and fine print (./Points)   logon, dial-out, the code, accounted for; then what it needs
 * and the foot opens 05: commands from anywhere.
 *
 * The section owns two pieces of state that tie its parts together: the platform the tabs show (it picks
 * both the install line and the tray or menu bar), and whether the machine is taking work (the switch stops
 * the install card's poll dots too). Both start where the server renders them - PowerShell, on - so the
 * prerender and the first client render agree; the tabs exist only once enhanced, and without a script
 * both platforms are on the page, one under the other. Copy lives in ./AlwaysOn/copy.ts.
 *
 * Layout: phones stack everything (gaps 12); from 768 Devices spans the width with the install card and the
 * switch side by side (7fr 5fr) and the points 2×2; from 1200 a 12-column grid - Devices in 1-7, the two
 * cards in 8-12 stretched to its height, the points in a row of four 48px below, the fine print across.
 */
import { useState } from 'react';
import { reveal, useEnhanced } from '../motion';
import { ArrowLink, Grad, Section } from './kit';
import { Devices } from './AlwaysOn/Devices';
import { Enrol } from './AlwaysOn/Enrol';
import { FinePrint, Points } from './AlwaysOn/Points';
import { SwitchTile } from './AlwaysOn/Switch';
import { FOOT, type Platform } from './AlwaysOn/copy';
import './AlwaysOn.css';

export function AlwaysOn() {
  const enhanced = useEnhanced();
  const [platform, setPlatform] = useState<Platform>('ps');
  const [taking, setTaking] = useState(true);
  const [touched, setTouched] = useState(false);
  const toggle = () => {
    setTaking((t) => !t);
    setTouched(true);
  };
  return (
    <Section
      id="it"
      index="04"
      label="For IT"
      head="split"
      pool="left"
      title={
        <>
          Put it on a machine that’s always on. <Grad>It lives there.</Grad>
        </>
      }
      lead="An office PC, a Windows VM that stays signed in, the Mac in the corner. The agent starts at logon, asks your account for work every few seconds and carries out commands in plain words on its own screen — on one machine or fifty at once."
      stageClassName="it-stage"
      foot={<ArrowLink href={FOOT.href}>{FOOT.text}</ArrowLink>}
    >
      <div className="it-grid">
        <div className="it-main" {...reveal('panel', 0)}>
          <Devices />
        </div>
        <div className="it-side">
          <div className="it-side-a" {...reveal('panel', 1)}>
            <Enrol platform={platform} onPlatform={setPlatform} taking={taking} enhanced={enhanced} />
          </div>
          <div className="it-side-b" {...reveal('panel', 2)}>
            <SwitchTile platform={platform} taking={taking} touched={touched} onToggle={toggle} enhanced={enhanced} />
          </div>
        </div>
        <Points />
        <FinePrint />
      </div>
    </Section>
  );
}
