import { useState } from 'react';
import { AddMyParent } from '../../../components/auth/AddMyParent';
import { extractApiErrorCode } from '../../../utils/apiError';
import { remindParents } from '../../parents/familyLinks';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import './ask-parent.css';

/**
 * A teen's own offered place, under 18 (owner, 2 November 2026): the teen does the rest themselves, but the place needs
 * a parent's yes. "Remind my parent" tells their parents, at most once a day; with no parent yet, the "Add my parent"
 * link instead. It brings its own styles: it stands on the case page and in the joining chat.
 */
export function AskParent({ caseId }: { caseId: number }) {
    const copy = useJourneyCopy();
    const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'noParent' | 'failed'>('idle');
    const remind = async () => {
        setState('busy');
        try { await remindParents(caseId); setState('sent'); }
        catch (failure) { setState(extractApiErrorCode(failure) === 'ADD_A_PARENT' ? 'noParent' : 'failed'); }
    };
    return <div className="ask-parent">
        <p className="ask-parent__notice">{copy('Under 18, a parent says yes to the place. They get it in GrassKickZ.', '18 წლამდე ადგილს მშობელი ეთანხმება. ის ამას GrassKickZ-ში მიიღებს.')}</p>
        {state === 'noParent' ? <AddMyParent waiting={false} />
            : <button type="button" className="ask-parent__go" disabled={state === 'busy' || state === 'sent'} onClick={() => void remind()}>
                {state === 'sent' ? copy('Reminder sent', 'შეხსენება გაიგზავნა') : copy('Remind my parent', 'მშობლისთვის შეხსენება')}</button>}
        {state === 'failed' && <p role="alert" className="ask-parent__notice">{copy('The reminder didn’t go. Try again.', 'შეხსენება ვერ გაიგზავნა. სცადეთ ხელახლა.')}</p>}
    </div>;
}
