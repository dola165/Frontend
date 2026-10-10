import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { apiClient } from '../../../../api/axiosConfig';
import { useAuth } from '../../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { Button, ButtonLink, EmptyNote, Field, Panel, Skeleton } from '../../../../design/primitives';
import { profileKindLabel, type ClubPresentation, type ProfileKind, type TrainingProgramme } from '../../../clubs/presentation';
import { ProgrammeEditor } from './ProgrammeEditor';
import { SponsorsEditor } from './SponsorsEditor';
import { AffiliationsEditor } from './AffiliationsEditor';
import '../../../clubOperations/records/records.css';

type Part = 'all' | 'profile' | 'programmes';
const emptyProgramme = (): TrainingProgramme => ({ name: '', ageMin: null, ageMax: null, sessionsPerWeek: null, priceType: 'UNPUBLISHED', amount: null, currency: '', billingPeriod: 'MONTH', trialAmount: null, joiningFee: null, equipmentFee: null, details: null, published: false, squadIds: [], validFrom: null, validUntil: null });

/**
 * The club's public profile: its purpose, training programmes and fees, sponsors and academy links.
 * `part` shows one area (Settings shows the profile, Club business shows programmes); every save sends
 * the whole profile with its revision, so the other area is kept exactly as loaded.
 */
export function ClubPresentationSettings({ clubId, part = 'all' }: { clubId: number; part?: Part }) {
    const { sessionId, user } = useAuth();
    return <Editor key={`${clubId}-${user?.id}-${sessionId}`} clubId={clubId} part={part} />;
}

function Editor({ clubId, part }: { clubId: number; part: Part }) {
    const [profile, setProfile] = useState<ClubPresentation | null>(null);
    const [error, setError] = useState(''), [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [dirty, setDirty] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [query, setQuery] = useState(''), [matches, setMatches] = useState<Array<{ id: number; name: string }>>([]), [searchError, setSearchError] = useState('');
    const [squads, setSquads] = useState<Array<{ id: number; name: string }>>([]);
    const active = useRef(true), submitting = useRef(false);
    useEffect(() => {
        let current = true; active.current = true; setLoading(true); setError('');
        void apiClient.get<ClubPresentation>(`/clubs/${clubId}/presentation/manage`).then(r => { if (current) { setProfile(r.data); setDirty(false); } })
            .catch(e => { if (current) setError(extractApiErrorMessage(e, 'Could not load profile settings.')); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; active.current = false; };
    }, [clubId, attempt]);
    useEffect(() => {
        if (part === 'profile') return;
        const c = new AbortController();
        void apiClient.get<Array<{ id: number; name: string }>>(`/clubs/${clubId}/squads`, { signal: c.signal }).then(r => setSquads(Array.isArray(r.data) ? r.data : []))
            .catch(() => { if (!c.signal.aborted) setError('Squads could not be loaded. Reload before changing programme assignments.'); });
        return () => c.abort();
    }, [clubId, part]);
    useEffect(() => {
        let current = true;
        if (query.trim().length < 2) return;
        const timer = setTimeout(() => {
            void apiClient.get<Array<{ id: number; name: string }>>('/clubs/search', { params: { q: query.trim(), limit: 8 } })
                .then(r => { if (current) { setMatches(r.data.filter(c => c.id !== clubId)); setSearchError(''); } })
                .catch(() => { if (current) setSearchError('Club search is unavailable. Try again.'); });
        }, 250);
        return () => { current = false; clearTimeout(timer); };
    }, [clubId, query]);
    const change = (value: Partial<ClubPresentation>) => { setProfile(p => p ? { ...p, ...value } : p); setDirty(true); setMessage(''); };
    const mutate = async (operation: () => Promise<{ data: ClubPresentation }>, success: string) => {
        if (submitting.current || uploading) return;
        submitting.current = true; setBusy(true); setError(''); setMessage('');
        try { const r = await operation(); if (active.current) { setProfile(r.data); setDirty(false); setMessage(success); setQuery(''); setMatches([]); } }
        catch (e) { if (active.current) setError(extractApiErrorMessage(e, 'Could not save the changes. Your draft is still here.')); }
        finally { submitting.current = false; if (active.current) setBusy(false); }
    };
    const save = (event: FormEvent) => {
        event.preventDefault(); if (!profile) return;
        const { revision, profileKind, programmes, sponsors } = profile;
        const editableSponsors = sponsors.map(({ id, name, logoUrl, websiteUrl, organizationId, published }) => ({ id, name, logoUrl, websiteUrl, organizationId, published }));
        void mutate(() => apiClient.put(`/clubs/${clubId}/presentation`, { revision, profileKind, programmes, sponsors: editableSponsors }), 'Public profile settings saved.');
    };

    if (loading) return <div className="cw-loading" role="status" aria-label="Loading public profile settings"><Skeleton height={48} /><Skeleton height={220} /></div>;
    if (!profile) return <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => setAttempt(a => a + 1)}>Retry profile settings</Button></div>;
    if (!profile.canEdit) return <EmptyNote title="Only club owners and administrators can edit this profile" />;
    const own = profile.canManageAffiliations === true;
    const showProfile = part !== 'programmes', showProgrammes = part !== 'profile';
    return <div className="gk-stack">
        {error && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" disabled={busy} onClick={() => setAttempt(a => a + 1)}>Discard draft & reload</Button></div>}
        {message && <div className="gk-notice cw-notices__success" role="status">{message}</div>}
        {!own && <div className="gk-notice" role="status">You are editing this academy’s public profile through access granted to its parent club.</div>}
        <form onSubmit={save} className="rec-form rec-form--wide" aria-label={part === 'programmes' ? 'Programmes and fees' : 'Public profile settings'}>
            <fieldset disabled={busy || uploading} className="gk-stack">
                {showProfile && <Panel flush title="Profile purpose" action={<ButtonLink size="sm" variant="ghost" to={`/clubs/${clubId}`}>View profile</ButtonLink>}>
                    <div className="rec-form__group">
                        <Field label="Profile purpose" htmlFor="profile-kind" hint="Club profiles lead with teams, news and history. Academy profiles put training and family information first. Community profiles suit amateur and school football.">
                            <select id="profile-kind" disabled={!own} className="gk-input" value={profile.profileKind} onChange={e => change({ profileKind: e.target.value as ProfileKind })}>{Object.entries(profileKindLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
                        </Field>
                    </div>
                </Panel>}
                {showProgrammes && <div className="gk-stack gk-stack--tight">
                    {profile.programmes.length ? profile.programmes.map((p, index) => <ProgrammeEditor key={p.id ?? `new-${index}`} programme={p} index={index} squads={squads}
                        onChange={value => change({ programmes: profile.programmes.map((x, i) => i === index ? { ...x, ...value } : x) })}
                        onRemove={() => change({ programmes: profile.programmes.filter((_, i) => i !== index) })} />)
                        : <Panel><EmptyNote title="No training programmes yet">Add a programme so families can see ages, sessions and fees on the club page.</EmptyNote></Panel>}
                    <div><Button disabled={profile.programmes.length >= 30} onClick={() => change({ programmes: [...profile.programmes, emptyProgramme()] })}><Plus aria-hidden="true" />Add training programme</Button></div>
                </div>}
                {showProfile && <SponsorsEditor sponsors={profile.sponsors} onChange={sponsors => change({ sponsors })} onUploading={setUploading} />}
                <div className="rec-actions"><Button type="submit" variant="primary" disabled={!dirty || busy}>{busy ? 'Saving…' : part === 'programmes' ? 'Save programmes' : 'Save profile settings'}</Button>
                    <p className="rec-actions__note">{dirty ? 'You have unsaved changes.' : 'Everything is saved.'}</p></div>
            </fieldset>
        </form>
        {showProfile && <AffiliationsEditor profile={profile} own={own} locked={dirty} busy={busy || uploading} query={query} matches={matches} searchError={searchError}
            onQuery={value => { setQuery(value); setMatches([]); setSearchError(''); }}
            act={(path, body, method, success) => void mutate(() => method === 'put' ? apiClient.put(`/clubs/${clubId}${path}`, body) : apiClient.post(`/clubs/${clubId}${path}`, body), success)} />}
    </div>;
}
