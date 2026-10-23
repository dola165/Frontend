import { useId, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button, Field, Skeleton } from '../../../design/primitives';
import { PersonProfilePreview } from '../../profiles/person/PersonProfilePreview';
import { isOffered, isProfessionalRole, type FootballRole } from '../../roles/domain';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { SETUP_CHOICES, useChoiceName } from '../setupWords';
import type { WelcomeFacts } from '../useWelcomeFacts';
import { useFitWidth } from '../useFitWidth';
import { previewOf, type HistoryInput, type SetupDraft, type SetupProfile } from '../useSetupProfile';
import { ADULT_ROLES } from '../welcomeSteps';
import { PhotoField, TownLine } from './AboutStep';
import { SkillPicker } from './SkillPicker';

/** The width the profile page is drawn at in the preview, then scaled to the pane. */
const PAGE_WIDTH = 1100;

/** Adds one football history line to the draft: what, where, since when. Saved with the profile. */
function HistoryForm({ roles, onAdd, onCancel }: { roles: string[]; onAdd: (entry: HistoryInput) => void; onCancel: () => void }) {
    const copy = useJourneyCopy();
    const name = useChoiceName();
    const id = useId();
    const [values, setValues] = useState({ role: roles[0], title: '', organization: '', since: '' });
    const [error, setError] = useState('');
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!values.title.trim() || !values.since) { setError(copy('Add what you did and since when.', 'მიუთითეთ, რას აკეთებდით და როდიდან.')); return; }
        onAdd({ role: values.role, title: values.title, organization: values.organization, startsOn: `${values.since}-01` });
    };
    return <form className="gk-setup-history__form" onSubmit={submit}>
        {roles.length > 1 && <Field label={copy('As', 'როგორც')} htmlFor={`${id}-role`}>
            <select id={`${id}-role`} className="gk-input" value={values.role} onChange={event => setValues(current => ({ ...current, role: event.target.value }))}>
                {roles.map(role => <option key={role} value={role}>{name(role)}</option>)}
            </select>
        </Field>}
        <Field label={copy('What you did', 'რას აკეთებდით')} htmlFor={`${id}-title`}>
            <input id={`${id}-title`} className="gk-input" maxLength={160} placeholder={copy('For example U14 coach', 'მაგალითად U14 მწვრთნელი')} value={values.title} onChange={event => setValues(current => ({ ...current, title: event.target.value }))} />
        </Field>
        <Field label={copy('Club or organisation', 'კლუბი ან ორგანიზაცია')} htmlFor={`${id}-org`}>
            <input id={`${id}-org`} className="gk-input" maxLength={200} value={values.organization} onChange={event => setValues(current => ({ ...current, organization: event.target.value }))} />
        </Field>
        <Field label={copy('Since', 'როდიდან')} htmlFor={`${id}-since`}>
            <input id={`${id}-since`} type="month" className="gk-input" max={new Date().toISOString().slice(0, 7)} value={values.since} onChange={event => setValues(current => ({ ...current, since: event.target.value }))} />
        </Field>
        {error && <p className="gk-setup__error" role="alert">{error}</p>}
        <div className="gk-setup-history__actions">
            <Button size="sm" variant="ghost" onClick={onCancel}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button size="sm" type="submit">{copy('Add', 'დამატება')}</Button>
        </div>
    </form>;
}

/**
 * Step 4: the profile as a short editing column beside the profile page itself, drawn from the draft as they type.
 * "Save profile" saves it. On a phone, Edit and Preview are two tabs.
 */
export function ProfileStep({ setup, draft, onChange, facts, main, suggestion, userId }: {
    setup: SetupProfile; draft: SetupDraft | null; onChange: (draft: SetupDraft) => void; facts: WelcomeFacts; main: FootballRole | null; suggestion: string; userId: number;
}) {
    const copy = useJourneyCopy();
    const id = useId();
    const [pane, setPane] = useState<'edit' | 'preview'>('edit');
    const [adding, setAdding] = useState(false);
    const { pane: previewPane, style: previewStyle } = useFitWidth(Boolean(draft && setup.loaded), PAGE_WIDTH);
    if (!draft || !setup.loaded) return <div role="status" aria-label={copy('Loading your profile', 'პროფილი იტვირთება')} className="gk-setup__loading"><Skeleton height={72} /><Skeleton height={48} /><Skeleton height={48} /></div>;
    const loaded = setup.loaded;
    const preview = previewOf(loaded, draft, suggestion, userId);
    const offered = SETUP_CHOICES.filter(item => item.id !== 'BUSINESS' && isOffered(item.id, draft.roles) && (facts.adult || !(ADULT_ROLES as readonly string[]).includes(item.id)));
    const toggleRole = (role: FootballRole) => onChange({ ...draft, roles: draft.roles.includes(role) ? draft.roles.filter(item => item !== role) : [...draft.roles, role] });
    const historyRoles = draft.roles.filter(isProfessionalRole);
    const history = [...loaded.history.map(entry => ({ key: `saved-${entry.id}`, title: entry.title, organization: entry.organization, startsOn: entry.startsOn })),
        ...draft.history.map((entry, index) => ({ key: `new-${index}`, ...entry }))];

    return <div className="gk-setup-editor" data-pane={pane}>
        <div className="gk-setup-editor__tabs" role="tablist" aria-label={copy('Your profile', 'თქვენი პროფილი')}>
            {(['edit', 'preview'] as const).map(item => <button key={item} type="button" role="tab" aria-selected={pane === item} onClick={() => setPane(item)}>
                {item === 'edit' ? copy('Edit', 'რედაქტირება') : copy('Preview', 'გადახედვა')}
            </button>)}
        </div>
        <div className="gk-setup-editor__edit">
            <PhotoField name={draft.fullName} url={loaded.profile.avatarUrl} setup={setup} />
            <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}>
                <input id={`${id}-name`} className="gk-input" maxLength={100} value={draft.fullName} onChange={event => onChange({ ...draft, fullName: event.target.value })} />
            </Field>
            {draft.roles.length > 0 && <Field label={copy('Headline', 'სათაური')} htmlFor={`${id}-headline`}>
                <input id={`${id}-headline`} className="gk-input" maxLength={120} value={draft.headline ?? suggestion} onChange={event => onChange({ ...draft, headline: event.target.value })} />
            </Field>}
            <Field label={copy('About me', 'ჩემ შესახებ')} htmlFor={`${id}-about`}>
                <textarea id={`${id}-about`} className="gk-input" rows={3} maxLength={300} value={draft.bio} onChange={event => onChange({ ...draft, bio: event.target.value })} />
            </Field>
            <div className="gk-field">
                <span className="gk-field__label" id={`${id}-roles`}>{copy('Roles', 'როლები')}</span>
                <div className="gk-setup-toggles" role="group" aria-labelledby={`${id}-roles`}>
                    {offered.map(item => <button key={item.id} type="button" aria-pressed={draft.roles.includes(item.id as FootballRole)} onClick={() => toggleRole(item.id as FootballRole)}>{copy(item.en[0], item.ka[0])}</button>)}
                </div>
            </div>
            <SkillPicker draft={draft} onChange={onChange} main={main} />
            {historyRoles.length > 0 && <div className="gk-field">
                <span className="gk-field__label">{copy('Football history', 'საფეხბურთო ისტორია')}</span>
                {history.length > 0 && <ul className="gk-setup-history">{history.map(entry => <li key={entry.key}><strong>{entry.title}</strong><small>{[entry.organization, entry.startsOn.slice(0, 4)].filter(Boolean).join(' · ')}</small></li>)}</ul>}
                {adding
                    ? <HistoryForm roles={historyRoles} onCancel={() => setAdding(false)} onAdd={entry => { onChange({ ...draft, history: [...draft.history, entry] }); setAdding(false); }} />
                    : <button type="button" className="gk-setup__link" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{copy('Add to your history', 'ისტორიაში დამატება')}</button>}
            </div>}
            <TownLine facts={facts} />
        </div>
        <div className="gk-setup-editor__preview" ref={previewPane} aria-label={copy('Preview of your profile', 'თქვენი პროფილის გადახედვა')}>
            <div className="gk-setup-editor__page" style={previewStyle}>
                <PersonProfilePreview profile={preview.person} professions={preview.professions} />
            </div>
        </div>
    </div>;
}
