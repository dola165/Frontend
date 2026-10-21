import { useAccountCopy } from './accountCopy';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { Button, EmptyNote, Field, Panel, Section, Skeleton } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { saveAbout, type PersonProfile } from '../api';

const LIMIT = 1000;

/** The few lines at the top of your profile: your football and your work, in your own words. */
export function AboutEditor({ userId }: { userId: number }) {
    const copy = useAccountCopy();
    const [bio, setBio] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const active = useRef(true);
    useEffect(() => {
        const controller = new AbortController();
        active.current = true;
        setFailed(false);
        void apiClient.get<PersonProfile>(`/users/${userId}`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setBio(response.data.bio ?? ''); })
            .catch(() => { if (!controller.signal.aborted) setFailed(true); });
        return () => { controller.abort(); active.current = false; };
    }, [userId, attempt]);
    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (saving || bio === null) return;
        setSaving(true); setError(''); setSaved(false);
        try { await saveAbout(bio.trim()); if (active.current) setSaved(true); }
        catch (reason) { if (active.current) setError(extractApiErrorMessage(reason, 'About me couldn’t be saved. Your text is still here.')); }
        finally { if (active.current) setSaving(false); }
    };
    return <Section id="about" title={copy("About me")}>
        {failed ? <Panel><EmptyNote title={copy("About me couldn’t load")} action={<Button onClick={() => setAttempt(value => value + 1)}>{copy("Retry")}</Button>} /></Panel>
            : bio === null ? <Panel padded><Skeleton height={120} /></Panel>
            : <form onSubmit={save} className="gk-roles">
                <Field label={copy("Introduce yourself")} htmlFor="gk-about" hint={copy(`${bio.length} of ${LIMIT} characters. Shown at the top of your profile.`, `${bio.length} / ${LIMIT} სიმბოლო. ჩანს თქვენი პროფილის დასაწყისში.`)}>
                    <textarea id="gk-about" className="gk-input" rows={5} maxLength={LIMIT} disabled={saving} value={bio} placeholder={copy("Your football, your work and what you can help clubs and families with.")}
                        onChange={event => { setSaved(false); setBio(event.target.value); }} /></Field>
                {error && <p className="gk-notice gk-notice--danger" role="alert">{copy(error)}</p>}
                <div className="gk-roles__foot"><span />
                    <div className="gk-row">{saved && <span role="status" className="gk-roles__saved">{copy("Saved.")}</span>}<Button type="submit" variant="primary" disabled={saving}>{saving ? copy("Saving…") : copy("Save about me")}</Button></div>
                </div>
            </form>}
    </Section>;
}
