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
    back: () => void;
    close: () => void;
}

/** The welcome's one dialog over Home: "Welcome · 1 of 2", the title, one grey line, the screen and its footer. */
export function WelcomeFrame({ position, title, hint, onClose, back, footer, children }: {
    position: 1 | 2; title: string; hint?: string; onClose: () => void; back?: () => void; footer: ReactNode; children: ReactNode;
}) {
    const copy = useJourneyCopy();
    return <Dialog open size="lg" className="gk-welcome-dialog" title={title} description={hint} onClose={onClose}
        closeLabel={copy('Close', 'დახურვა')} eyebrow={copy(`Welcome · ${position} of 2`, `მოგესალმებით · ${position} / 2`)}
        footer={<>
            {back && <Button variant="ghost" className="gk-welcome__back" onClick={back}>{copy('Back', 'უკან')}</Button>}
            {footer}
        </>}>
        <div className="gk-welcome">{children}</div>
    </Dialog>;
}
