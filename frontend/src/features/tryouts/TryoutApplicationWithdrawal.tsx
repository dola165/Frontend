import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/axiosConfig';
import type { MyTryoutApplication } from '../../api/tryouts';
import { extractApiErrorMessage } from '../../utils/apiError';
import './tryout-withdrawal.css';

export function TryoutApplicationWithdrawal({ application, onChanged }: {
    application: MyTryoutApplication; onChanged: () => void;
}) {
    const { i18n } = useTranslation();
    const ka = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    const copy = (en: string, ge: string) => ka ? ge : en;
    const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const alive = useRef(false), request = useRef<AbortController | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
    const withdraw = async () => {
        if (request.current) return;
        const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
        try {
            await apiClient.post(`/tryouts/applications/${application.id}/withdraw`, {}, { signal: controller.signal });
            if (alive.current && !controller.signal.aborted) { setReview(false); onChanged(); }
        } catch (e) {
            if (alive.current && !controller.signal.aborted) setError(extractApiErrorMessage(e, copy('Could not withdraw. Refresh your applications and try again.', 'განაცხადის გაუქმება ვერ მოხერხდა. განაახლეთ სია და სცადეთ ხელახლა.')));
        } finally { request.current = null; if (alive.current) setBusy(false); }
    };
    if (application.status === 'WITHDRAWN') return <p role="status" className="gk-tryout-withdrawal">
        {copy('Withdrawn by you. Your application history is retained.', 'განაცხადი თქვენ გააუქმეთ. ისტორია შენარჩუნებულია.')}
    </p>;
    if (!['PENDING', 'SHORTLISTED'].includes(application.status) || application.tryoutLifecycleStatus === 'CANCELLED') return null;
    return <div className="gk-tryout-withdrawal">
        {review ? <>
            <p>{copy('Withdraw this application? The club will be notified. You cannot apply to this same tryout again.', 'გააუქმოთ განაცხადი? კლუბი მიიღებს შეტყობინებას. ამავე სინჯზე ხელახლა განაცხადს ვეღარ შეიტანთ.')}</p>
            <button type="button" disabled={busy} onClick={() => void withdraw()}>{busy ? copy('Withdrawing…', 'უქმდება…') : copy('Confirm withdrawal', 'დაადასტურეთ გაუქმება')}</button>
            <button type="button" disabled={busy} onClick={() => { setReview(false); setError(''); }}>{copy('Keep application', 'განაცხადის შენარჩუნება')}</button>
        </> : <button type="button" onClick={() => setReview(true)}>{copy('Withdraw application', 'განაცხადის გაუქმება')}</button>}
        {error && <p role="alert">{error}</p>}
    </div>;
}
