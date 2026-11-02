import { useEffect, useState, useSyncExternalStore } from 'react';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { loadHandoff, type HandoffContext, type HandoffOverview, type HandoffScope, type HandoffTarget } from './api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/** No data survives a scope/session change or a failed authority refresh. Drafts live elsewhere. */
export function useAdmissionHandoff<T extends HandoffOverview | HandoffContext>(scope: HandoffScope, target?: HandoffTarget) {
    const copy = useJourneyCopy();
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const { clubId, actorId, caseId, caseVersion, sessionId } = scope;
    const key = JSON.stringify([scope, target, session]);
    const [refresh, setRefresh] = useState(0);
    const [state, setState] = useState<{ key: string; data?: T; error?: string }>();
    const [checking, setChecking] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        const fetch = () => {
            setChecking(true);
            // Hide previously permitted context during every check, including role-loss checks.
            setState({ key });
            if (session !== sessionId) {
                setState({ key, error: 'account' });
                setChecking(false); return;
            }
            void loadHandoff<T>({ clubId, actorId, caseId, caseVersion, sessionId }, controller.signal, target).then(data => {
                if (!controller.signal.aborted) setState({ key, data });
            }).catch((failure: unknown) => {
                if (controller.signal.aborted) return;
                const status = (failure as { response?: { status?: number } }).response?.status;
                const error = status === 403 || status === 404 ? 'unavailable' : status === 409 ? 'changed' : 'failed';
                setState({ key, error });
            }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
        };
        fetch();
        const onFocus = () => setRefresh(value => value + 1);
        const onVisible = () => { if (document.visibilityState === 'visible') onFocus(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);
        return () => { controller.abort(); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); };
    }, [key, refresh, session, clubId, actorId, caseId, caseVersion, sessionId, target]);
    const messages: Record<string, string> = {
        account: copy('Your account changed. Reopen this follow-up from your current workspace.', 'ანგარიში შეიცვალა. საკითხი თქვენი მიმდინარე სამუშაო სივრციდან ხელახლა გახსენით.'),
        unavailable: copy('This admission follow-up is unavailable with your current authority or placement.', 'ჩარიცხვის ეს საკითხი მიმდინარე უფლებამოსილებით ან ჩარიცხვის მდგომარეობით მიუწვდომელია.'),
        changed: copy('The admission changed. Reopen this follow-up and review the current terms.', 'ჩარიცხვა შეიცვალა. საკითხი ხელახლა გახსენით და მიმდინარე პირობები გადაამოწმეთ.'),
        failed: copy('Could not check this admission follow-up. Try again.', 'ჩარიცხვის საკითხის შემოწმება ვერ მოხერხდა. ხელახლა სცადეთ.'),
    };
    return { data: state?.key === key ? state.data : undefined, error: state?.key === key && state.error ? messages[state.error] : undefined,
        loading: checking || state?.key !== key, refresh: () => setRefresh(value => value + 1) };
}
