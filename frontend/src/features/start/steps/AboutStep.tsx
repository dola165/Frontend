import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2, LocateFixed } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Avatar, Button, Field, Skeleton } from '../../../design/primitives';
import type { useRoleProfiles } from '../../profiles/account/useRoleProfiles';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { countryOf, saveAbout, useSuggestedHeadline } from '../setupWords';
import { saveStart } from '../startApi';
import { TOWNS } from '../towns';
import type { WelcomeFacts } from '../useWelcomeFacts';
import { aboutDraft, type AboutDraft, type SetupProfile } from '../useSetupProfile';

/** One short line per chosen role, on that role's section: where they play, the age groups they coach, their work, their level. */
export function RoleFields({ draft, onChange, chosen }: { draft: AboutDraft; onChange: (key: keyof AboutDraft, value: string) => void; chosen: string[] }) {
    const copy = useJourneyCopy();
    const id = useId();
    const set = (key: keyof AboutDraft) => (event: ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value);
    const fields = [
        chosen.includes('PLAYER') && <Field key="playing" label={copy('Where you play', 'სად თამაშობთ')} htmlFor={`${id}-playing`}>
            <input id={`${id}-playing`} className="gk-input" maxLength={120} placeholder={copy('For example central midfield, left foot', 'მაგალითად ცენტრალური ნახევარმცველი, მარცხენა ფეხი')} value={draft.playing} onChange={set('playing')} />
        </Field>,
        chosen.includes('COACH') && <Field key="ages" label={copy('Age groups you coach', 'ასაკობრივი ჯგუფები, რომლებსაც წვრთნით')} htmlFor={`${id}-ages`}>
            <input id={`${id}-ages`} className="gk-input" maxLength={120} placeholder={copy('For example U10, U12', 'მაგალითად U10, U12')} value={draft.coachAges} onChange={set('coachAges')} />
        </Field>,
        chosen.includes('CLUB_STAFF') && <Field key="work" label={copy('Your work at the club', 'თქვენი საქმე კლუბში')} htmlFor={`${id}-work`}>
            <input id={`${id}-work`} className="gk-input" maxLength={120} placeholder={copy('For example kit manager, physio', 'მაგალითად ეკიპირების მენეჯერი, ფიზიოთერაპევტი')} value={draft.staffWork} onChange={set('staffWork')} />
        </Field>,
        chosen.includes('REFEREE') && <Field key="level" label={copy('Refereeing level', 'სამსაჯო დონე')} htmlFor={`${id}-level`}>
            <input id={`${id}-level`} className="gk-input" maxLength={120} placeholder={copy('For example regional, national', 'მაგალითად რეგიონული, ეროვნული')} value={draft.refereeLevel} onChange={set('refereeLevel')} />
        </Field>,
    ].filter(Boolean);
    return fields.length ? <div className="gk-setup__grid">{fields}</div> : null;
}

/** The person's photo with one small action to change it. */
export function PhotoField({ name, url, setup }: { name: string; url: string; setup: SetupProfile }) {
    const copy = useJourneyCopy();
    const input = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<'idle' | 'uploading' | 'failed'>('idle');
    const choose = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setState('uploading');
        try { await setup.uploadPhoto(file); setState('idle'); } catch { setState('failed'); }
    };
    return <div className="gk-setup__photo">
        <Avatar src={url || null} name={name} size={56} />
        <div className="gk-setup__photo-text">
            <Button size="sm" disabled={state === 'uploading'} onClick={() => input.current?.click()}>
                {state === 'uploading' ? <Loader2 className="gk-setup__spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
                {url ? copy('Change photo', 'ფოტოს შეცვლა') : copy('Add a photo', 'ფოტოს დამატება')}
            </Button>
            <small className={state === 'failed' ? 'gk-setup__error' : undefined} role={state === 'failed' ? 'alert' : undefined}>
                {state === 'failed' ? copy('That photo could not be uploaded. Try another.', 'ფოტო ვერ აიტვირთა. სცადეთ სხვა.') : copy('Optional.', 'არასავალდებულო.')}
            </small>
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={event => void choose(event)} />
    </div>;
}

/** The town, said in small text and changed in place: a known town, or the device's position. */
export function TownLine({ facts }: { facts: WelcomeFacts }) {
    const copy = useJourneyCopy();
    const userId = useAuth().user?.id;
    const [changing, setChanging] = useState(false);
    const place = facts.place;
    if (!place) return null;
    const georgia = (place.countryCode ?? 'GE') === 'GE';
    const where = place.source === 'SAVED' ? place.name : place.source === 'CONNECTION' ? countryOf(place) : copy('Not set', 'არ არის მითითებული');
    const pick = (name: string) => {
        const town = TOWNS.find(item => item.name === name);
        if (!town || !userId) return;
        setChanging(false);
        void saveStart(userId, { town: { ...town, countryCode: 'GE' } }).catch(() => undefined);
    };
    return <p className="gk-setup__town">
        <span>{copy('Town', 'ქალაქი')}: <strong>{where}</strong></span>
        {changing && georgia
            ? <select className="gk-input gk-input--sm" aria-label={copy('Your town', 'თქვენი ქალაქი')} defaultValue="" onChange={event => pick(event.target.value)}>
                <option value="" disabled>{copy('Choose your town', 'აირჩიეთ ქალაქი')}</option>
                {TOWNS.map(town => <option key={town.name} value={town.name}>{town.name}</option>)}
            </select>
            : georgia && <button type="button" className="gk-setup__link" onClick={() => setChanging(true)}>{copy('Change', 'შეცვლა')}</button>}
        <button type="button" className="gk-setup__link" disabled={facts.locating === 'locating'} onClick={() => void facts.locate()}>
            {facts.locating === 'locating' ? <Loader2 className="gk-setup__spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}{copy('Use my location', 'ჩემი მდებარეობით')}
        </button>
        {facts.locating === 'failed' && <span role="status">{copy('Location not available.', 'მდებარეობა მიუწვდომელია.')}</span>}
    </p>;
}

/** Step 2: what people see on the profile. Everything optional; Next saves what changed. */
export function AboutStep({ setup, roles, facts, register }: { setup: SetupProfile; roles: ReturnType<typeof useRoleProfiles>; facts: WelcomeFacts; register: (save: (() => Promise<boolean>) | null) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const suggestion = useSuggestedHeadline(roles.profiles, facts.place);
    // What the person changed, over the profile as loaded.
    const [edited, setEdited] = useState<AboutDraft | null>(null);
    const [error, setError] = useState('');
    const draft = edited ?? (setup.profile && roles.state === 'ready' && facts.ready ? aboutDraft(setup.profile, roles.profiles, suggestion) : null);
    const update = (key: keyof AboutDraft, value: string) => setEdited(current => current ?? draft ? { ...(current ?? draft)!, [key]: value } : current);
    // Next saves what changed here; the dialog asks for it.
    useEffect(() => {
        register(async () => {
            if (!draft) return true;
            const failure = await saveAbout(draft, setup, roles, copy('Your details couldn’t be saved. They are still here.', 'მონაცემები ვერ შეინახა. ისინი აქვეა.'));
            setError(failure);
            return !failure;
        });
        return () => register(null);
    });
    if (setup.failed) return <p className="gk-notice gk-notice--danger" role="alert">{copy('Your profile couldn’t load.', 'პროფილი ვერ ჩაიტვირთა.')} <button type="button" className="gk-setup__link" onClick={setup.retry}>{copy('Retry', 'ხელახლა ცდა')}</button></p>;
    if (!draft || !setup.profile) return <div role="status" aria-label={copy('Loading your profile', 'პროფილი იტვირთება')} className="gk-stack gk-stack--tight"><Skeleton height={56} width={220} /><Skeleton height={40} /><Skeleton height={64} /></div>;
    const change = (key: keyof AboutDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, event.target.value);
    return <div className="gk-setup__form">
        <PhotoField name={setup.profile.fullName} url={setup.profile.avatarUrl} setup={setup} />
        <Field label={copy('Headline', 'სათაური')} htmlFor={`${id}-headline`} hint={copy('One line under your name.', 'ერთი სტრიქონი თქვენი სახელის ქვეშ.')}>
            <input id={`${id}-headline`} className="gk-input" maxLength={120} value={draft.headline} onChange={change('headline')} />
        </Field>
        <Field label={copy('About me', 'ჩემ შესახებ')} htmlFor={`${id}-about`} hint={copy('One or two lines.', 'ერთი-ორი სტრიქონი.')}>
            <textarea id={`${id}-about`} className="gk-input" rows={2} maxLength={300} value={draft.bio} onChange={change('bio')} />
        </Field>
        <TownLine facts={facts} />
        <RoleFields draft={draft} onChange={update} chosen={roles.profiles.map(item => item.role)} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
