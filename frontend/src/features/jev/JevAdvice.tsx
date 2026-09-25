import { adviceLabel } from './labels';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../../utils/authStorage';
import './jev.css';

export type Advice = { outcome: string; suggestions: Record<string, string> };
type AdviceProps = {
    endpoint: string; input: Record<string, unknown>; kind: 'listing' | 'career' | 'report'; disabled?: boolean;
    onApply?: (value: string) => void;
};
export function JevAdvice(props: AdviceProps) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    // A new draft/session owns its own request state, including when text is undone.
    return <AdviceRequest key={JSON.stringify([session, props.endpoint, props.input, props.kind])} {...props} session={session} />;
}
function AdviceRequest({ endpoint, input, kind, disabled = false, onApply, session }: AdviceProps & { session: ReturnType<typeof getAuthSessionId> }) {
    const { i18n } = useTranslation();
    const ka = i18n?.language?.startsWith('ka');
    const pending = useRef<AbortController | null>(null);
    const [busy, setBusy] = useState(false);
    const [advice, setAdvice] = useState<Advice | null>(null);
    useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
    const check = async () => {
        if (pending.current || disabled || !isCurrentAuthSession(session)) return;
        const controller = new AbortController(); pending.current = controller; setBusy(true);
        try {
            const { data } = await apiClient.post<Advice>(endpoint, input, { signal: controller.signal });
            if (!controller.signal.aborted && isCurrentAuthSession(session)) setAdvice(data);
        } catch {
            if (!controller.signal.aborted && isCurrentAuthSession(session)) setAdvice({ outcome: 'unavailable', suggestions: {} });
        } finally {
            if (pending.current === controller) { pending.current = null; setBusy(false); }
        }
    };
    const selected = advice?.suggestions[kind === 'career' ? 'kind' : 'category'];
    const button = kind === 'listing' ? (ka ? 'განცხადების შემოწმება' : 'Check this listing')
        : kind === 'career' ? (ka ? 'ჩანაწერის ტიპის შეთავაზება' : 'Suggest entry type') : (ka ? 'განხილვის პრიორიტეტის შეთავაზება' : 'Suggest review priority');
    const fallback = advice?.outcome === 'budget' || advice?.outcome === 'daily_limit'
        ? (ka ? 'დახმარების ლიმიტი ამოიწურა. გააგრძელეთ ხელით.' : 'The assistance allowance has been reached. You can continue manually.')
        : advice?.outcome === 'private_content'
            ? (ka ? 'შეზღუდული პოსტი ხელით განიხილეთ.' : 'Review this restricted post manually.')
            : (ka ? 'სანდო შეთავაზება ვერ მომზადდა. გააგრძელეთ ხელით.' : 'No reliable suggestion is available. You can continue manually.');
    return <aside className="jev-advice" aria-label={button}>
        <div className="jev-actions"><button type="button" disabled={disabled || busy || !!advice} onClick={() => void check()}>{busy ? (ka ? 'მოწმდება…' : 'Checking…') : button}</button><span>{ka ? 'არასავალდებულო' : 'Optional'}</span></div>
        <p>{kind === 'report'
            ? (ka ? 'მხოლოდ მოთხოვნისას, საჯარო პოსტის ტექსტს ამუშავებს TypeSafe. გადაწყვეტილებას ადმინისტრატორი იღებს.' : 'Only when requested, TypeSafe processes the public post text. An administrator makes the decision.')
            : (ka ? 'მხოლოდ ღილაკზე დაჭერისას, ტექსტს და არჩეულ კატეგორიებს ამუშავებს TypeSafe. შეამოწმეთ შეთავაზება შენახვამდე.' : 'Only when you press this button, TypeSafe processes the text and selected categories. Review suggestions before saving.')}</p>
        {advice && <div role="status" aria-live="polite">
            {advice.outcome === 'classified' ? <>
                {selected && <p><strong>{ka ? 'შემოთავაზებული ტიპი: ' : 'Suggested category: '}{adviceLabel(selected, ka)}</strong></p>}
                {Object.entries(advice.suggestions).filter(([key]) => key !== 'category' && key !== 'kind').map(([key, value]) => <p key={key}>{adviceLabel(value, ka)}</p>)}
                {selected && onApply && <button type="button" disabled={disabled} onClick={() => onApply(selected)}>{ka ? 'შეთავაზების გამოყენება' : 'Use suggestion'}</button>}
                {kind === 'career' && <p>{ka ? 'ინფორმაცია რჩება თვითდეკლარირებულად. კვალიფიკაცია არ მოწმდება.' : 'This remains self-reported. Qualifications are not verified.'}</p>}
            </> : <p>{fallback}</p>}
        </div>}
    </aside>;
}
