import { ImageUploadField } from '../../../components/workspace/editor/ImageUploadField';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save } from 'lucide-react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { updateTournament } from '../api';
import type { TournamentDetail, TournamentVisibility, UpdateTournamentPayload } from '../domain';
import { tournamentSetupCopy } from '../tournamentSetupCopy';
import { tournamentSettingsCopy } from '../tournamentSettingsCopy';

interface Props { tournament: TournamentDetail; onUpdate: (value: TournamentDetail) => void; onSavingChange?: (saving: boolean) => void; embedded?: boolean; }
type Policy = NonNullable<TournamentDetail['registrationPolicy']>;
type SettingsForm = {
    name: string; description: string; rules: string; visibility: TournamentVisibility; registrationPolicy: Policy;
    startDate: string; endDate: string; registrationOpensAt: string; registrationClosesAt: string;
    incentives: string; bannerImageUrl: string;
};
// API dates are local date-times. Keep their wall-clock values in the editor.
const dateInput = (value?: string | null) => value?.slice(0, 16) ?? '';
const readForm = (value: TournamentDetail): SettingsForm => ({
    name: value.name, description: value.description ?? '', rules: value.rules ?? '', visibility: value.visibility,
    registrationPolicy: value.registrationPolicy ?? 'OPEN', startDate: dateInput(value.startDate), endDate: dateInput(value.endDate),
    registrationOpensAt: dateInput(value.registrationOpensAt), registrationClosesAt: dateInput(value.registrationClosesAt),
    incentives: value.incentives ?? '', bannerImageUrl: value.bannerImageUrl ?? '',
});
const formKeys: (keyof SettingsForm)[] = ['name', 'description', 'rules', 'visibility', 'registrationPolicy', 'startDate', 'endDate', 'registrationOpensAt', 'registrationClosesAt', 'incentives', 'bannerImageUrl'];

export function TournamentSettings(props: Props) {
    return <TournamentSettingsForm key={props.tournament.id} {...props} />;
}

function TournamentSettingsForm({ tournament, onUpdate, onSavingChange, embedded = false }: Props) {
    const { i18n } = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
    const copy = tournamentSettingsCopy(language);
    const setup = tournamentSetupCopy(language);
    const incoming = readForm(tournament);
    const received = JSON.stringify(incoming);
    const [draft, setDraft] = useState(() => ({ form: incoming, baseline: incoming, received }));
    const [saving, setSaving] = useState(false);
    const [uploading,setUploading]=useState(false);
    const uploadBusy=(value:boolean)=>{setUploading(value);onSavingChange?.(value);};
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const pending = useRef(false);
    const mounted = useRef(true);
    const formElement = useRef<HTMLFormElement>(null);
    // Other workspace actions refresh the record. Adopt updates to untouched fields,
    // while keeping fields the organizer is currently editing.
    if (draft.received !== received) {
        const next = { ...draft.form };
        for (const key of formKeys) {
            if (draft.form[key] === draft.baseline[key]) Object.assign(next, { [key]: incoming[key] });
        }
        setDraft({ form: next, baseline: incoming, received });
    }
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const form = draft.form;
    const locked = tournament.status !== 'PLANNING';
    const changed = formKeys.filter(key => form[key] !== draft.baseline[key]);
    const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
        setDraft(current => ({ ...current, form: { ...current.form, [key]: value } }));
        setError(''); setNotice('');
    };
    const fail = (message: string, name: keyof SettingsForm) => {
        setError(message);
        const field = formElement.current?.querySelector<HTMLInputElement>(`[name="${name}"]`);
        let parent = field?.parentElement;
        while (parent && parent !== formElement.current) {
            if (parent instanceof HTMLDetailsElement) parent.open = true;
            parent = parent.parentElement;
        }
        field?.focus();
        return false;
    };
    const validate = () => {
        if (!form.name.trim()) return fail(setup.nameRequired, 'name');
        if (!form.startDate) return fail(copy.requiredStart, 'startDate');
        if (!form.endDate) return fail(copy.requiredEnd, 'endDate');
        if (form.endDate < form.startDate) return fail(setup.dateOrder, 'endDate');
        if (form.registrationOpensAt && form.registrationClosesAt && form.registrationClosesAt < form.registrationOpensAt) return fail(setup.registrationOrder, 'registrationClosesAt');
        if (form.registrationClosesAt && form.registrationClosesAt > form.startDate) return fail(setup.registrationBeforeStart, 'registrationClosesAt');
        return true;
    };
    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (locked || uploading || pending.current || !changed.length || !validate()) return;
        const payload: UpdateTournamentPayload = {};
        for (const key of changed) {
            if (key === 'registrationOpensAt' && !form[key]) payload.clearRegistrationOpensAt = true;
            else if (key === 'registrationClosesAt' && !form[key]) payload.clearRegistrationClosesAt = true;
            // Empty text clears optional content; null means leave it unchanged.
            else Object.assign(payload, { [key]: form[key].trim() });
        }
        pending.current = true; setSaving(true); setError(''); setNotice('');
        onSavingChange?.(true);
        try {
            const updated = await updateTournament(tournament.id, payload);
            if (!mounted.current) return;
            const saved = readForm(updated);
            setDraft(current => ({ ...current, form: saved, baseline: saved }));
            setNotice(copy.saved);
            onUpdate(updated);
        } catch (err) {
            if (mounted.current) setError(extractApiErrorMessage(err, copy.error));
        } finally {
            pending.current = false;
            if (mounted.current) { setSaving(false); onSavingChange?.(false); }
        }
    };
    const policyHints: Record<Policy, string> = { APPROVAL_ONLY: copy.approvalHint, OPEN: copy.openHint, INVITE_ONLY: copy.inviteHint };
    const visibilityHints: Record<TournamentVisibility, string> = { PRIVATE: setup.privateHint, PUBLIC: setup.publicHint, UNLISTED: setup.unlistedHint };

    return <>
        {!embedded && <div className="tw-toolbar"><div><h2>{copy.title}</h2><p>{copy.intro}</p></div>{tournament.organizerName && <p>{copy.organizer} <strong>{tournament.organizerName}</strong></p>}</div>}
        <form className={embedded ? 'tw-settings tw-edit-form' : 'tw-panel tw-panel-pad tw-settings'} ref={formElement} aria-label={copy.title} aria-busy={saving} noValidate onSubmit={save}>
            {locked && <p className="tw-notice">{copy.locked}</p>}
            <fieldset disabled={saving || uploading || locked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <h3 style={{ marginBottom: 18 }}>{copy.details}</h3>
                <label className="tw-field">{setup.name}<input className="tw-input" name="name" maxLength={255} required value={form.name} onChange={event => update('name', event.target.value)} /></label>
                <label className="tw-field">{setup.description}<textarea name="description" maxLength={4000} rows={3} value={form.description} onChange={event => update('description', event.target.value)} placeholder={setup.descriptionPlaceholder} /></label>
                <div className="tw-form-grid">
                    <label className="tw-field"><span>{setup.visibility}</span><select name="visibility" value={form.visibility} aria-describedby="tw-settings-visibility-hint" onChange={event => update('visibility', event.target.value as TournamentVisibility)}><option value="PRIVATE">{setup.private}</option><option value="UNLISTED">{setup.unlisted}</option><option value="PUBLIC">{setup.public}</option></select><small id="tw-settings-visibility-hint" style={{ fontWeight: 400, color: 'var(--tw-muted)' }}>{visibilityHints[form.visibility]}</small></label>
                    <label className="tw-field"><span>{copy.registrationPolicy}</span><select name="registrationPolicy" value={form.registrationPolicy} aria-describedby="tw-settings-registration-hint" onChange={event => update('registrationPolicy', event.target.value as Policy)}><option value="APPROVAL_ONLY">{copy.approval}</option><option value="OPEN">{copy.open}</option><option value="INVITE_ONLY">{copy.invite}</option></select><small id="tw-settings-registration-hint" style={{ fontWeight: 400, color: 'var(--tw-muted)' }}>{policyHints[form.registrationPolicy]}</small></label>
                </div>
                <details style={{ borderTop: '1px solid var(--tw-line)', padding: '18px 0' }}>
                    <summary>{copy.schedule}</summary><p style={{ fontSize: 12, margin: '10px 0 18px' }}>{copy.scheduleHint}</p>
                    <div className="tw-form-grid">
                        <label className="tw-field">{setup.starts}<input className="tw-input" type="datetime-local" name="startDate" required value={form.startDate} onChange={event => update('startDate', event.target.value)} /></label>
                        <label className="tw-field">{setup.ends}<input className="tw-input" type="datetime-local" name="endDate" required value={form.endDate} min={form.startDate || undefined} onChange={event => update('endDate', event.target.value)} /></label>
                        <label className="tw-field">{setup.registrationOpens}<input className="tw-input" type="datetime-local" name="registrationOpensAt" value={form.registrationOpensAt} onChange={event => update('registrationOpensAt', event.target.value)} /></label>
                        <label className="tw-field">{setup.registrationCloses}<input className="tw-input" type="datetime-local" name="registrationClosesAt" value={form.registrationClosesAt} min={form.registrationOpensAt || undefined} max={form.startDate || undefined} onChange={event => update('registrationClosesAt', event.target.value)} /></label>
                    </div>
                </details>
                <details style={{ borderTop: '1px solid var(--tw-line)', padding: '18px 0' }}>
                    <summary>{copy.extras}</summary><div style={{ marginTop: 18 }}>
                        <label className="tw-field">{setup.rules}<textarea name="rules" maxLength={10000} rows={4} value={form.rules} onChange={event => update('rules', event.target.value)} placeholder={setup.rulesPlaceholder} /></label>
                        <label className="tw-field">{copy.prizes}<textarea name="incentives" maxLength={5000} rows={3} value={form.incentives} onChange={event => update('incentives', event.target.value)} placeholder={copy.prizesPlaceholder} /></label>
                        <ImageUploadField label={copy.banner} max={1} context="banner" images={form.bannerImageUrl ? [form.bannerImageUrl] : []} onChange={images=>update('bannerImageUrl',images[0]??'')} onBusyChange={uploadBusy} disabled={locked||saving}/>
                    </div>
                </details>
            </fieldset>
            {error && <p className="tw-error" role="alert">{error}</p>}{notice && <p className="tw-notice" role="status">{notice}</p>}
            <div className="tw-actions tw-edit-actions"><p style={{ fontSize: 12 }}>{locked ? copy.readOnly : changed.length ? copy.unsaved : copy.unchanged}</p><button type="submit" className="tw-primary" disabled={locked || saving || uploading || !changed.length}>{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? copy.saving : copy.save}</button></div>
        </form>
    </>;
}
