import type { ReactNode } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { WelcomeFacts } from './useWelcomeFacts';
import type { Choice } from './welcomeSteps';
import type { StartPreferences } from '../preferences/preferencesStore';
import './welcome.css';

/** What every screen of the welcome gets: what is known, landing with an answer, Back to step 1 and closing. */
export interface WelcomeStepProps {
    facts: WelcomeFacts;
    /** Ends the welcome with this answer and opens `to` (Home when null), keeping `extra` in the preferences. */
    land: (choice: Choice, to: string | null, extra?: Partial<StartPreferences>) => void;
    /** Ends the welcome with this answer and stays: the step already opened the next page (a club just started). */
    finish: (choice: Choice) => void;
    back: () => void;
    close: () => void;
}

/**
 * The welcome's one dialog over Home: "Welcome · 1 of 2", the title, one grey line, the screen and its footer. Big, so
 * the choice is the page (owner, 26 October): `choose` for picking one tile (step 1, a business's kind), `work` close
 * to a full page for a list (clubs, work), scrolling inside. On a phone it fills the screen. Only X, Skip and Escape
 * close it, never a click beside it (owner, 27 October).
 */
export function WelcomeFrame({ position, size = position === 1 ? 'choose' : 'work', title, hint, onClose, back, footer, children }: {
    position: 1 | 2; size?: 'choose' | 'work'; title: string; hint?: string; onClose: () => void; back?: () => void; footer: ReactNode; children: ReactNode;
}) {
    const copy = useJourneyCopy();
    return <Dialog open size="lg" className={`gk-welcome-dialog gk-welcome-dialog--${size}`} title={title} description={hint} onClose={onClose} backdropCloses={false}
        closeLabel={copy('Close', 'დახურვა')} eyebrow={copy(`Welcome · ${position} of 2`, `მოგესალმებით · ${position} / 2`)}
        footer={<>
            {back && <Button variant="ghost" className="gk-welcome__back" onClick={back}>{copy('Back', 'უკან')}</Button>}
            {footer}
        </>}>
        <div className="gk-welcome">{children}</div>
    </Dialog>;
}
