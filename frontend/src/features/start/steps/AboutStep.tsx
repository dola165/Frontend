import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2, LocateFixed } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Avatar, Button, Field, Skeleton } from '../../../design/primitives';
import type { FootballRole } from '../../roles/domain';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { countryOf } from '../setupWords';
import { saveStart } from '../startApi';
import { TOWNS } from '../towns';
import type { WelcomeFacts } from '../useWelcomeFacts';
import type { SetupDraft, SetupProfile } from '../useSetupProfile';
import { SkillPicker } from './SkillPicker';

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

/**
 * Step 2: what people see on the profile: photo, headline (on the main role's section, so only with a role), a line
 * or two, the town, and "What do you do?". Everything optional; Next saves what changed.
 */
export function AboutStep({ setup, draft, onChange, facts, main, suggestion }: {
    setup: SetupProfile; draft: SetupDraft | null; onChange: (draft: SetupDraft) => void; facts: WelcomeFacts; main: FootballRole | null; suggestion: string;
}) {
    const copy = useJourneyCopy();
    const id = useId();
    if (setup.failed) return <p className="gk-notice gk-notice--danger" role="alert">{copy('Your profile couldn’t load.', 'პროფილი ვერ ჩაიტვირთა.')} <button type="button" className="gk-setup__link" onClick={setup.retry}>{copy('Retry', 'ხელახლა ცდა')}</button></p>;
    if (!draft || !setup.loaded) return <div role="status" aria-label={copy('Loading your profile', 'პროფილი იტვირთება')} className="gk-setup__loading"><Skeleton height={56} width={220} /><Skeleton height={40} /><Skeleton height={64} /></div>;
    return <div className="gk-setup__form">
        <PhotoField name={draft.fullName} url={setup.loaded.profile.avatarUrl} setup={setup} />
        {draft.roles.length > 0 && <Field label={copy('Headline', 'სათაური')} htmlFor={`${id}-headline`} hint={copy('One line under your name.', 'ერთი სტრიქონი თქვენი სახელის ქვეშ.')}>
            <input id={`${id}-headline`} className="gk-input" maxLength={120} value={draft.headline ?? suggestion} onChange={event => onChange({ ...draft, headline: event.target.value })} />
        </Field>}
        <Field label={copy('About me', 'ჩემ შესახებ')} htmlFor={`${id}-about`} hint={copy('One or two lines.', 'ერთი-ორი სტრიქონი.')}>
            <textarea id={`${id}-about`} className="gk-input" rows={2} maxLength={300} value={draft.bio} onChange={event => onChange({ ...draft, bio: event.target.value })} />
        </Field>
        <TownLine facts={facts} />
        <SkillPicker draft={draft} onChange={onChange} main={main} />
    </div>;
}
