import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Building2, ChevronRight, MapPin, Shield, Trophy, Users, type LucideIcon } from 'lucide-react';
import { Avatar, Button, Field, Skeleton } from '../../../design/primitives';
import { createHref } from '../../pages/create/entry';
import type { useRoleProfiles } from '../../profiles/account/useRoleProfiles';
import { isProfessionalRole } from '../../roles/domain';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { WelcomeFacts } from '../useWelcomeFacts';
import { aboutDraft, rolesToKeep, type AboutDraft, type SetupProfile } from '../useSetupProfile';
import type { Step } from '../welcomeSteps';
import { saveAbout, useRoleName, useSuggestedHeadline } from '../setupWords';
import { PhotoField, RoleFields } from './AboutStep';
import { RoleChecklist } from './RolesStep';

const HOME = { pathname: '/home', search: '' };
type Section = 'identity' | 'roles' | 'about' | 'history';
type Roles = ReturnType<typeof useRoleProfiles>;

/** One part of the preview with its own Edit; editing happens in place, one part at a time. */
function Part({ title, editing, onEdit, editLabel, children }: { title: string; editing: boolean; onEdit?: () => void; editLabel: string; children: ReactNode }) {
    return <section className="gk-setup-part" aria-label={title}>
        <header className="gk-setup-part__head"><h3>{title}</h3>{!editing && onEdit && <button type="button" className="gk-setup__link" onClick={onEdit}>{editLabel}</button>}</header>
        {children}
    </section>;
}

/** Save and Cancel under a part being edited. */
function EditActions({ busy, error, onCancel }: { busy: boolean; error: string; onCancel: () => void }) {
    const copy = useJourneyCopy();
    return <>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        <div className="gk-setup-part__actions">
            <Button size="sm" variant="ghost" onClick={onCancel}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button size="sm" variant="primary" type="submit" disabled={busy}>{busy ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</Button>
        </div>
    </>;
}

/** Adds one football history line: what, where, since when. */
function HistoryForm({ roles, setup, onDone }: { roles: string[]; setup: SetupProfile; onDone: () => void }) {
    const copy = useJourneyCopy();
    const roleName = useRoleName();
    const id = useId();
    const [values, setValues] = useState({ role: roles[0], title: '', organization: '', since: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!values.title.trim() || !values.since) { setError(copy('Add what you did and since when.', 'მიუთითეთ, რას აკეთებდით და როდიდან.')); return; }
        setBusy(true); setError('');
        try { await setup.addHistory({ role: values.role, title: values.title, organization: values.organization, startsOn: `${values.since}-01` }); onDone(); }
        catch { setError(copy('That couldn’t be saved. It is still here.', 'ვერ შეინახა. ჩანაწერი აქვეა.')); }
        finally { setBusy(false); }
    };
    const month = new Date().toISOString().slice(0, 7);
    return <form className="gk-setup-part__form" onSubmit={event => void submit(event)}>
        <div className="gk-setup__grid">
            {roles.length > 1 && <Field label={copy('As', 'როგორც')} htmlFor={`${id}-role`}>
                <select id={`${id}-role`} className="gk-input" value={values.role} onChange={event => setValues(current => ({ ...current, role: event.target.value }))}>
                    {roles.map(role => <option key={role} value={role}>{roleName(role)}</option>)}
                </select>
            </Field>}
            <Field label={copy('What you did', 'რას აკეთებდით')} htmlFor={`${id}-title`}>
                <input id={`${id}-title`} className="gk-input" maxLength={160} placeholder={copy('For example U14 coach', 'მაგალითად U14 მწვრთნელი')} value={values.title} onChange={event => setValues(current => ({ ...current, title: event.target.value }))} />
            </Field>
            <Field label={copy('Club or organisation', 'კლუბი ან ორგანიზაცია')} htmlFor={`${id}-org`}>
                <input id={`${id}-org`} className="gk-input" maxLength={200} value={values.organization} onChange={event => setValues(current => ({ ...current, organization: event.target.value }))} />
            </Field>
            <Field label={copy('Since', 'როდიდან')} htmlFor={`${id}-since`}>
                <input id={`${id}-since`} type="month" className="gk-input" max={month} value={values.since} onChange={event => setValues(current => ({ ...current, since: event.target.value }))} />
            </Field>
        </div>
        <EditActions busy={busy} error={error} onCancel={onDone} />
    </form>;
}

/** What each chosen role leads to next, outside the setup; a business page for any adult. */
function useNextMoves(chosen: string[], adult: boolean) {
    const copy = useJourneyCopy();
    const has = (...roles: string[]) => roles.some(role => chosen.includes(role));
    const moves: { id: string; icon: LucideIcon; label: string; hint: string; to: string; quiet?: boolean }[] = [];
    if (!adult) return moves;
    if (has('COACH', 'CLUB_STAFF', 'ORGANIZER')) moves.push({ id: 'club', icon: Shield, label: copy('Create your club’s page', 'შექმენით კლუბის გვერდი'), hint: copy('If your club isn’t here yet.', 'თუ თქვენი კლუბი აქ ჯერ არ არის.'), to: createHref(HOME, 'CLUB', 'start') });
    if (has('PARENT')) moves.push({ id: 'child', icon: Users, label: copy('Add your child', 'დაამატეთ შვილი'), hint: copy('In Parent Hub, with their club.', 'მშობლის სივრცეში, მათი კლუბით.'), to: '/parent?tab=children' });
    if (has('ORGANIZER')) moves.push({ id: 'tournament', icon: Trophy, label: copy('Create a tournament', 'შექმენით ტურნირი'), hint: copy('Teams, fixtures and results in one place.', 'გუნდები, მატჩები და შედეგები ერთად.'), to: '/tournaments/setup' });
    if (has('VENUE_MANAGER')) moves.push({ id: 'venue', icon: MapPin, label: copy('Add your venue', 'დაამატეთ თქვენი მოედანი'), hint: copy('Starts with its page.', 'იწყება მისი გვერდით.'), to: createHref(HOME, 'PAGE', 'start') });
    moves.push({ id: 'business', icon: Building2, label: copy('Here for a business? Create an organisation page', 'ბიზნესი ხართ? შექმენით ორგანიზაციის გვერდი'), hint: '', to: createHref(HOME, 'BUSINESS', 'start'), quiet: true });
    return moves;
}

/**
 * Step 4: the finished profile as others see it, each part editable in place, then what to do next. "What's next" rows
 * are the only things in the setup that leave it.
 */
export function ProfileStep({ setup, roles, facts, leave, goTo }: { setup: SetupProfile; roles: Roles; facts: WelcomeFacts; leave: (to: string) => void; goTo: (step: Step) => void }) {
    const copy = useJourneyCopy();
    const roleName = useRoleName();
    const id = useId();
    const suggestion = useSuggestedHeadline(roles.profiles, facts.place);
    const [editing, setEditing] = useState<Section | null>(null);
    const [draft, setDraft] = useState<AboutDraft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const chosen = roles.profiles.map(item => item.role);
    const moves = useNextMoves(chosen, facts.adult);
    const profile = setup.profile;
    if (!profile || roles.state !== 'ready') return <div role="status" aria-label={copy('Loading your profile', 'პროფილი იტვირთება')} className="gk-stack gk-stack--tight"><Skeleton height={72} /><Skeleton height={48} /><Skeleton height={48} /></div>;

    const headline = (roles.profiles.find(item => item.primary) ?? roles.profiles[0])?.headline?.trim() ?? '';
    const edit = (section: Section) => { setError(''); setDraft(aboutDraft(profile, roles.profiles, '')); setEditing(section); };
    const close = () => { setEditing(null); setError(''); };
    const failure = copy('That couldn’t be saved. It is still here.', 'ვერ შეინახა. ჩანაწერი აქვეა.');
    const saveDraft = async (event: FormEvent) => {
        event.preventDefault();
        if (!draft) return;
        setBusy(true);
        const problem = await saveAbout(draft, setup, roles, failure);
        setBusy(false);
        if (problem) setError(problem); else close();
    };
    const saveRoles = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        const stored = await roles.save(rolesToKeep(roles.profiles));
        setBusy(false);
        if (stored) close(); else setError(failure);
    };
    const set = (key: keyof AboutDraft) => (value: string) => setDraft(current => current && { ...current, [key]: value });
    const details = [
        roles.profiles.find(item => item.role === 'PLAYER')?.specialties,
        roles.profiles.find(item => item.role === 'COACH')?.specialties, roles.profiles.find(item => item.role === 'CLUB_STAFF')?.specialties,
        roles.profiles.find(item => item.role === 'REFEREE')?.qualifications,
    ].filter(Boolean).join(' · ');
    const historyRoles = chosen.filter(isProfessionalRole);
    const nothing = <p className="gk-setup__hint">{copy('Nothing yet.', 'ჯერ არაფერია.')}</p>;
    const editLabel = copy('Edit', 'შეცვლა');

    return <div className="gk-setup__form">
        <article className="gk-setup-card" aria-label={copy('Your profile', 'თქვენი პროფილი')}>
            {editing === 'identity' && draft
                ? <form className="gk-setup-part__form" onSubmit={event => void saveDraft(event)}>
                    <PhotoField name={profile.fullName} url={profile.avatarUrl} setup={setup} />
                    <div className="gk-setup__grid">
                        <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" maxLength={100} value={draft.fullName} onChange={event => set('fullName')(event.target.value)} /></Field>
                        <Field label={copy('Headline', 'სათაური')} htmlFor={`${id}-headline`}><input id={`${id}-headline`} className="gk-input" maxLength={120} placeholder={suggestion} value={draft.headline} onChange={event => set('headline')(event.target.value)} /></Field>
                    </div>
                    <EditActions busy={busy} error={error} onCancel={close} />
                </form>
                : <header className="gk-setup-card__head">
                    <Avatar src={profile.avatarUrl || null} name={profile.fullName} size={56} />
                    <div className="gk-setup-card__who"><strong>{profile.fullName}</strong>{headline ? <span>{headline}</span> : <span className="gk-setup__hint">{copy('No headline yet.', 'სათაური ჯერ არ არის.')}</span>}</div>
                    {!editing && <button type="button" className="gk-setup__link" onClick={() => edit('identity')}>{editLabel}</button>}
                </header>}

            <Part title={copy('Roles', 'როლები')} editing={editing === 'roles'} onEdit={editing ? undefined : () => { setError(''); setEditing('roles'); }} editLabel={editLabel}>
                {editing === 'roles'
                    ? <form className="gk-setup-part__form" onSubmit={event => void saveRoles(event)}>
                        <RoleChecklist chosen={chosen} onToggle={roles.toggle} adult={facts.adult} label={copy('Football roles', 'საფეხბურთო როლები')} />
                        <EditActions busy={busy} error={error} onCancel={() => { roles.retry(); close(); }} />
                    </form>
                    : chosen.length ? <ul className="gk-setup-chips">{chosen.map(role => <li key={role}>{roleName(role)}</li>)}</ul> : nothing}
            </Part>

            <Part title={copy('About', 'შესახებ')} editing={editing === 'about'} onEdit={editing ? undefined : () => edit('about')} editLabel={editLabel}>
                {editing === 'about' && draft
                    ? <form className="gk-setup-part__form" onSubmit={event => void saveDraft(event)}>
                        <textarea className="gk-input" rows={2} maxLength={300} aria-label={copy('About me', 'ჩემ შესახებ')} value={draft.bio} onChange={event => set('bio')(event.target.value)} />
                        <RoleFields draft={draft} onChange={(key, value) => set(key)(value)} chosen={chosen} />
                        <EditActions busy={busy} error={error} onCancel={close} />
                    </form>
                    : <>{profile.bio ? <p className="gk-setup-part__text">{profile.bio}</p> : nothing}{details && <p className="gk-setup__hint">{details}</p>}</>}
            </Part>

            {historyRoles.length > 0 && <Part title={copy('Football history', 'საფეხბურთო ისტორია')} editing={editing === 'history'} onEdit={editing ? undefined : () => { setError(''); setEditing('history'); }} editLabel={copy('Add', 'დამატება')}>
                {setup.history?.length
                    ? <ul className="gk-setup-history">{setup.history.map(entry => <li key={entry.id}><strong>{entry.title}</strong><small>{[entry.organization, entry.startsOn.slice(0, 4)].filter(Boolean).join(' · ')}</small></li>)}</ul>
                    : editing !== 'history' && nothing}
                {editing === 'history' && <HistoryForm roles={historyRoles} setup={setup} onDone={close} />}
            </Part>}

            <Part title={copy('Clubs', 'კლუბები')} editing={false} onEdit={editing ? undefined : () => goTo('clubs')} editLabel={copy('Change', 'შეცვლა')}>
                <p className="gk-setup-part__text">{setup.followed == null ? '…' : copy(`Following ${setup.followed} ${setup.followed === 1 ? 'club' : 'clubs'}`, `მიჰყვებით ${setup.followed} კლუბს`)}</p>
            </Part>
        </article>

        {moves.length > 0 && <section className="gk-setup-next" aria-label={copy('What’s next', 'რა არის შემდეგ')}>
            <h3>{copy('What’s next', 'რა არის შემდეგ')}</h3>
            <ul>{moves.map(move => <li key={move.id}>
                <button type="button" className="gk-setup-next__row" data-quiet={move.quiet || undefined} onClick={() => leave(move.to)}>
                    <move.icon aria-hidden="true" />
                    <span className="gk-setup-next__text"><strong>{move.label}</strong>{move.hint && <small>{move.hint}</small>}</span>
                    <ChevronRight aria-hidden="true" />
                </button>
            </li>)}</ul>
        </section>}
    </div>;
}
