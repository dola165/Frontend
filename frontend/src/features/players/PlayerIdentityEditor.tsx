import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MediaImage } from '../../components/ui/MediaImage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { fetchPlayerIdentity, savePlayerIdentity, uploadPlayerPhoto } from '../joining-contract/api';
import type { PlayerIdentity, PlayerIdentityInput } from '../joining-contract/types';
import { AdmissionError, AdmissionLoading } from '../admissions/applicant/AdmissionFrame';
import { useAdmissionData } from '../admissions/applicant/useAdmissionData';
import { useAdmissionMutation } from '../admissions/applicant/useAdmissionMutation';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import './player-identity.css';
import { playerPositionChoices } from './playerIdentityLabels';

export interface PlayerIdentityEditorProps { playerId: number; onSaved?: () => void; onCancel?: () => void }
type Draft = Omit<PlayerIdentityInput, 'requestId' | 'expectedVersion' | 'heightCm' | 'weightKg'> & { height: string; weight: string };
const draftOf = (p: PlayerIdentity): Draft => ({
    fullName: p.fullName, dateOfBirth: p.dateOfBirth || '', gender: p.gender, photoUrl: p.photoUrl,
    positions: p.positions, dominantFoot: p.dominantFoot,
    height: p.heightCm == null ? '' : String(p.heightCm), weight: p.weightKg == null ? '' : String(p.weightKg),
});

export function PlayerIdentityEditor(props: PlayerIdentityEditorProps) {
    const { user, sessionId } = useAuth();
    return <IdentityForm key={`${user?.id}:${sessionId}:${props.playerId}`} {...props} />;
}

function IdentityForm({ playerId, onSaved, onCancel }: PlayerIdentityEditorProps) {
    const { sessionId } = useAuth();
    const copy = useJourneyCopy();
    const data = useAdmissionData(useCallback(signal => fetchPlayerIdentity(playerId, sessionId, signal), [playerId, sessionId]), sessionId);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [uploading, setUploading] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [saved, setSaved] = useState(false);
    const upload = useRef<AbortController | null>(null);
    const uploadLock = useRef(false);
    useEffect(() => () => upload.current?.abort(), []);
    useEffect(() => { if (data.data) setDraft(draftOf(data.data)); }, [data.data]);
    const mutation = useAdmissionMutation<Omit<PlayerIdentityInput, 'requestId'>, PlayerIdentity>(playerId, 'identity',
        body => savePlayerIdentity(playerId, body, sessionId), result => { data.setData(result); setSaved(true); onSaved?.(); }, data.refresh);
    async function uploadPhoto(file?: File) {
        if (!file || uploadLock.current) return;
        setPhotoError('');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            setPhotoError(copy('Choose a JPG, PNG or WebP photo up to 5 MB.', 'აირჩიეთ JPG, PNG ან WebP ფოტო, მაქსიმუმ 5 მბ.')); return;
        }
        upload.current?.abort(); const controller = new AbortController(); upload.current = controller;
        uploadLock.current = true; setUploading(true); setSaved(false);
        try {
            const result = await uploadPlayerPhoto(file, sessionId, controller.signal);
            if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setDraft(d => d ? { ...d, photoUrl: result.url } : d);
        } catch (error) {
            if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setPhotoError(extractApiErrorMessage(error, copy('The photo could not be uploaded. Please try again.', 'ფოტო ვერ აიტვირთა. სცადეთ ხელახლა.')));
        } finally { uploadLock.current = false; if (!controller.signal.aborted) setUploading(false); }
    }
    if (data.loading) return <AdmissionLoading />;
    if (data.error) return <AdmissionError message={data.error} retry={data.refresh} />;
    if (!data.data || !draft) return <AdmissionLoading />;
    if (!data.data.canEdit) return <div className="player-identity-editor"><p>{copy('Player details are managed by the player or their current guardian.', 'მოთამაშის მონაცემებს თავად მოთამაშე ან მოქმედი მეურვე მართავს.')}</p>{onCancel && <button className="admission-button" type="button" onClick={onCancel}>{copy('Close', 'დახურვა')}</button>}</div>;
    const disabled = uploading || mutation.busy || Boolean(mutation.pending);
    const change = (value: Partial<Draft>) => { setSaved(false); setDraft({ ...draft, ...value }); };
    const save = () => mutation.run({
        expectedVersion: data.data!.version, fullName: draft.fullName.trim(), dateOfBirth: draft.dateOfBirth,
        gender: draft.gender, photoUrl: draft.photoUrl, positions: draft.positions, dominantFoot: draft.dominantFoot,
        heightCm: draft.height === '' ? null : Number(draft.height), weightKg: draft.weight === '' ? null : Number(draft.weight),
    });
    return <form className="player-identity-editor" onSubmit={event => { event.preventDefault(); void save(); }} aria-busy={uploading || mutation.busy}>
        <p className="admission-muted">{copy('Basic details are enough to start. Add football details whenever they are useful.', 'დასაწყებად ძირითადი მონაცემები საკმარისია. საფეხბურთო დეტალები სურვილისამებრ დაამატეთ.')}</p>
        <div className="player-identity-fields">
            <label>{copy('Full name', 'სრული სახელი')}<input required maxLength={150} value={draft.fullName} disabled={disabled} onChange={e => change({ fullName: e.target.value })} /></label>
            <label>{copy('Date of birth', 'დაბადების თარიღი')}<input required type="date" min="1900-01-01" max={new Date().toLocaleDateString('en-CA')} value={draft.dateOfBirth || ''} disabled={disabled} onChange={e => change({ dateOfBirth: e.target.value })} /></label>
            <label>{copy('Declared gender (optional)', 'გაცხადებული სქესი (არასავალდებულო)')}<select value={draft.gender || ''} disabled={disabled} onChange={e => change({ gender: (e.target.value || null) as Draft['gender'] })}><option value="">{copy('Not stated', 'არ არის მითითებული')}</option><option value="MALE">{copy('Male', 'მამრობითი')}</option><option value="FEMALE">{copy('Female', 'მდედრობითი')}</option></select></label>
        </div>
        <fieldset disabled={disabled}><legend>{copy('Football details · optional', 'საფეხბურთო დეტალები · არასავალდებულო')}</legend>
            <div className="player-identity-photo">{draft.photoUrl && <MediaImage src={resolveMediaUrl(draft.photoUrl) || undefined} alt={copy('Player photo', 'მოთამაშის ფოტო')} />}
                <div><label>{copy('Private player photo', 'მოთამაშის პირადი ფოტო')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} /></label><small>{copy('JPG, PNG or WebP, up to 5 MB. Visible only to authorized family and staff.', 'JPG, PNG ან WebP, მაქსიმუმ 5 მბ. ხილულია მხოლოდ უფლებამოსილი ოჯახისა და თანამშრომლებისთვის.')}</small>{draft.photoUrl && <button type="button" className="admission-button" onClick={() => change({ photoUrl: null })}>{copy('Remove photo', 'ფოტოს წაშლა')}</button>}</div>
            </div>
            <fieldset><legend>{copy('Playing positions', 'სათამაშო პოზიციები')}</legend><div className="player-identity-positions">{playerPositionChoices.map(([code, en, ka]) => <label key={code}><input type="checkbox" checked={draft.positions.includes(code)} onChange={e => change({ positions: e.target.checked ? [...draft.positions, code] : draft.positions.filter(p => p !== code) })} />{copy(en, ka)}</label>)}</div></fieldset>
            <div className="player-identity-fields">
                <label>{copy('Dominant foot', 'წამყვანი ფეხი')}<select value={draft.dominantFoot || ''} onChange={e => change({ dominantFoot: (e.target.value || null) as Draft['dominantFoot'] })}><option value="">{copy('Not stated', 'არ არის მითითებული')}</option><option value="LEFT">{copy('Left', 'მარცხენა')}</option><option value="RIGHT">{copy('Right', 'მარჯვენა')}</option><option value="BOTH">{copy('Both', 'ორივე')}</option></select></label>
                <label>{copy('Height (cm)', 'სიმაღლე (სმ)')}<input type="number" min={40} max={250} step={0.1} value={draft.height} onChange={e => change({ height: e.target.value })} /></label>
                <label>{copy('Weight (kg)', 'წონა (კგ)')}<input type="number" min={5} max={250} step={0.1} value={draft.weight} onChange={e => change({ weight: e.target.value })} /></label>
            </div>
        </fieldset>
        {uploading && <p role="status">{copy('Uploading photo…', 'ფოტო იტვირთება…')}</p>}
        {photoError && <AdmissionError message={photoError} />}{mutation.error && <AdmissionError message={mutation.error} />}
        {saved && <p role="status">{copy('Player details saved.', 'მოთამაშის მონაცემები შენახულია.')}</p>}
        {mutation.pending && <p>{copy('Retry the saved update to confirm its result.', 'შედეგის დასადასტურებლად გაიმეორეთ შენახული განახლება.')}</p>}
        <div className="admission-actions"><button className="admission-button admission-primary" type={mutation.pending ? 'button' : 'submit'} disabled={uploading || mutation.busy} onClick={mutation.pending ? () => void mutation.retry() : undefined}>{mutation.busy ? copy('Saving…', 'ინახება…') : mutation.pending ? copy('Retry saved update', 'შენახული განახლების გამეორება') : copy('Save player card', 'მოთამაშის ბარათის შენახვა')}</button>{onCancel && <button className="admission-button" type="button" disabled={mutation.busy || uploading} onClick={onCancel}>{copy('Cancel', 'გაუქმება')}</button>}</div>
    </form>;
}
