import { useAccountCopy } from './accountCopy';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { Button, EmptyNote, Field, Panel, Section, Skeleton } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { footballRoles, isProfessionalRole, roleCopy, rolePresentation, type FootballRole, type RoleProfile } from '../../roles/domain';
import { RoleIcon } from '../person/RoleIcon';

/**
 * What you do in football: several roles at once, changeable any time. A role adds profile sections
 * and suggestions; it never grants anything in a club. New roles start hidden from the public profile.
 */
export function RolesEditor() {
    const copy = useAccountCopy();
    const { refreshNavigationCapabilities } = useAuth();
    const [profiles, setProfiles] = useState<RoleProfile[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const active = useRef(true), submitting = useRef(false);
    useEffect(() => {
        let current = true;
        active.current = true;
        setState('loading'); setError('');
        void apiClient.get<RoleProfile[]>('/users/me/roles')
            .then(response => { if (current) { setProfiles(response.data); setState('ready'); } })
            .catch(reason => { if (current) { setError(extractApiErrorMessage(reason, 'Your football roles couldn’t load.')); setState('failed'); } });
        return () => { current = false; active.current = false; };
    }, [attempt]);

    const change = (next: (current: RoleProfile[]) => RoleProfile[]) => { setSaved(false); setProfiles(next); };
    const update = (role: FootballRole, values: Partial<RoleProfile>) => change(current => current.map(item => item.role === role ? { ...item, ...values } : item));
    const toggle = (role: FootballRole) => change(current => {
        const remaining = current.filter(item => item.role !== role);
        if (remaining.length === current.length) return [...current, { role, primary: current.length === 0, published: false }];
        if (remaining.length && !remaining.some(item => item.primary)) remaining[0] = { ...remaining[0], primary: true };
        return remaining;
    });
    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true; setSaving(true); setError(''); setSaved(false);
        try {
            const response = await apiClient.put<RoleProfile[]>('/users/me/roles', { profiles });
            void refreshNavigationCapabilities().catch(() => undefined);
            if (active.current) { setProfiles(response.data); setSaved(true); }
        } catch (reason) {
            if (active.current) setError(extractApiErrorMessage(reason, 'Your football roles couldn’t be saved. Your changes are still here.'));
        } finally { submitting.current = false; if (active.current) setSaving(false); }
    };

    return <Section id="roles" title={copy("What you do in football")} hint={copy("Choose all that apply")}>
        {state === 'loading' ? <Panel padded><div role="status" aria-label={copy("Loading your roles")} className="gk-stack gk-stack--tight"><Skeleton height={72} /><Skeleton height={72} /></div></Panel>
            : state === 'failed' ? <Panel><EmptyNote title={copy("Your football roles couldn’t load")} action={<Button onClick={() => setAttempt(value => value + 1)}>{copy("Retry")}</Button>}><span role="alert">{copy(error)}</span></EmptyNote></Panel>
            : <form onSubmit={save} className="gk-roles">
                <fieldset disabled={saving} className="gk-roles__fieldset">
                    <legend className="gk-visually-hidden">{copy("Your football roles")}</legend>
                    <div className="gk-roles__options">{footballRoles.map(role => {
                        const checked = profiles.some(item => item.role === role);
                        const presentation = roleCopy(role, copy);
                        return <label key={role} className="gk-role-option" data-checked={checked || undefined}>
                            <input type="checkbox" checked={checked} onChange={() => toggle(role)} aria-describedby={`role-hint-${role}`} />
                            <RoleIcon role={role} />
                            <span className="gk-role-option__text"><strong>{presentation.label}</strong><small id={`role-hint-${role}`}>{presentation.description}</small></span>
                        </label>;
                    })}</div>
                    {profiles.map(item => <RoleDetails key={item.role} item={item} only={profiles.length === 1} onChange={values => update(item.role, values)}
                        onPrimary={() => change(current => current.map(other => ({ ...other, primary: other.role === item.role })))} />)}
                </fieldset>
                {error && <p className="gk-notice gk-notice--danger" role="alert">{copy(error)}</p>}
                <div className="gk-roles__foot">
                    <p className="gk-faint">{copy("Roles change what your profile shows. Access to a club, a squad or a child always comes from the club or family confirming it.")}</p>
                    <div className="gk-row">
                        {saved && <span role="status" className="gk-roles__saved">{copy("Your football roles have been saved.")}</span>}
                        <Button type="submit" variant="primary" disabled={saving || !profiles.length}>{saving ? copy("Saving…") : copy("Save roles")}</Button>
                    </div>
                </div>
            </form>}
    </Section>;
}

function RoleDetails({ item, only, onChange, onPrimary }: { item: RoleProfile; only: boolean; onChange: (values: Partial<RoleProfile>) => void; onPrimary: () => void }) {
    const copy = useAccountCopy();
    const presentation = rolePresentation[item.role];
    const label = roleCopy(item.role, copy).label;
    const id = `role-${item.role.toLowerCase()}`;
    return <section className="gk-role-details" aria-label={copy(`${presentation.label} details`, `${label} — დეტალები`)}>
        <header className="gk-role-details__head">
            <h3><RoleIcon role={item.role} />{label}</h3>
            <div className="gk-role-details__toggles">
                {!only && <label className="gk-role-details__toggle"><input type="radio" name="primaryRole" checked={item.primary} onChange={onPrimary} />{copy("Main role")}</label>}
                <label className="gk-role-details__toggle"><input type="checkbox" role="switch" className="gk-switch" checked={item.published} onChange={event => onChange({ published: event.target.checked })} />{copy("Show on my profile")}</label>
            </div>
        </header>
        <div className="gk-role-details__fields">
            <Field label={copy("Headline")} htmlFor={`${id}-headline`} hint={copy("One line people see under your name, for example “Youth coach · U14 and U16”.")}><input id={`${id}-headline`} className="gk-input" maxLength={120} value={item.headline ?? ''} onChange={event => onChange({ headline: event.target.value })} /></Field>
            <Field label={copy("Area you work in")} htmlFor={`${id}-area`}><input id={`${id}-area`} className="gk-input" maxLength={200} value={item.serviceArea ?? ''} onChange={event => onChange({ serviceArea: event.target.value })} /></Field>
            <Field label={copy(presentation.focus)} htmlFor={`${id}-focus`}><textarea id={`${id}-focus`} className="gk-input" rows={3} maxLength={1000} value={item.specialties ?? ''} onChange={event => onChange({ specialties: event.target.value })} /></Field>
            {(isProfessionalRole(item.role) || item.qualifications) && <Field label={copy("Qualifications")} htmlFor={`${id}-qualifications`} hint={copy("Shown as self-reported until a club or GrassKickZ confirms them.")}>
                <textarea id={`${id}-qualifications`} className="gk-input" rows={3} maxLength={1000} value={item.qualifications ?? ''} onChange={event => onChange({ qualifications: event.target.value })} /></Field>}
        </div>
        {presentation.destination && <Link className="gk-section__action" to={presentation.destination}>{item.role === 'PARENT' ? copy("Open Parent Hub") : copy("Manage organizations")}</Link>}
    </section>;
}
