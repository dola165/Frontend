import { ImageUploadField } from '../editor/ImageUploadField';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { profileKindLabel, type ClubPresentation, type ClubSponsor, type ProfileKind, type TrainingProgramme } from '../../../features/clubs/presentation';

const input = 'mt-1 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-sm';
const button = 'rounded-lg border border-[var(--fc-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50';
const emptyProgramme = (): TrainingProgramme => ({ name: '', ageMin: null, ageMax: null, sessionsPerWeek: null, priceType: 'UNPUBLISHED', amount: null, currency: '', billingPeriod: 'MONTH', trialAmount: null, joiningFee: null, equipmentFee: null, details: null, published: false, squadIds: [], validFrom: null, validUntil: null });

export const ClubPresentationSettings = ({ clubId }: { clubId: number }) => {
    const { sessionId, user } = useAuth();
    return <Editor key={`${clubId}-${user?.id}-${sessionId}`} clubId={clubId} />;
};

const Editor = ({ clubId }: { clubId: number }) => {
    const { i18n } = useTranslation();
    const [profile, setProfile] = useState<ClubPresentation | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [query, setQuery] = useState('');
    const [matches, setMatches] = useState<Array<{ id: number; name: string }>>([]);
    const [searchError, setSearchError] = useState('');
    const [squads, setSquads] = useState<Array<{id:number;name:string}>>([]);
    const active = useRef(true), submitting = useRef(false);
    useEffect(() => {
        let current = true; active.current = true; setLoading(true); setError('');
        void apiClient.get<ClubPresentation>(`/clubs/${clubId}/presentation/manage`).then(r => {
            if (current) { setProfile(r.data); setDirty(false); }
        }).catch(e => { if (current) setError(extractApiErrorMessage(e, 'Could not load profile settings.')); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; active.current = false; };
    }, [clubId, attempt]);
    useEffect(() => { const c=new AbortController(); void apiClient.get<Array<{id:number;name:string}>>(`/clubs/${clubId}/squads`,{signal:c.signal}).then(r=>setSquads(Array.isArray(r.data)?r.data:[])).catch(()=>{if(!c.signal.aborted)setError('Squads could not be loaded. Reload before changing programme assignments.');}); return()=>c.abort(); },[clubId]);
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
    const programme = (index: number, value: Partial<TrainingProgramme>) => change({ programmes: profile!.programmes.map((p, i) => i === index ? { ...p, ...value } : p) });
    const sponsor = (index: number, value: Partial<ClubSponsor>) => change({ sponsors: profile!.sponsors.map((p, i) => i === index ? { ...p, ...value } : p) });
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
    if (loading) return <p role="status">Loading public profile settings…</p>;
    if (!profile) return <div><p role="alert">{error}</p><button className={button} onClick={() => setAttempt(a => a + 1)}>Retry profile settings</button></div>;
    if (!profile.canEdit) return <p>Only club owners and administrators can edit this profile.</p>;
    const ownLeadership = profile.canManageAffiliations === true;
    return <section className="space-y-5 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-5 text-[var(--fc-text-primary)]">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Public club profile</h2><p className="mt-1 text-sm text-[var(--fc-text-secondary)]">Profile purpose, training prices, sponsors and academy affiliations.</p></div><Link to={`/clubs/${clubId}`} className="text-sm text-[var(--fc-accent)]">View profile →</Link></div>
        {error && <div role="alert" className="rounded-lg border border-[color:var(--color-danger)]/40 p-3 text-sm">{error}<button type="button" disabled={busy} className={`${button} ml-3`} onClick={() => setAttempt(a => a + 1)}>Discard draft & reload</button></div>}
        {message && <p role="status" className="text-sm text-[var(--fc-accent)]">{message}</p>}
        {!ownLeadership && <p className="text-sm">You are editing this academy's public profile through access granted to its parent club.</p>}
        <form onSubmit={save}>
            <fieldset disabled={busy || uploading} className="space-y-5">
                <label className="block text-sm font-semibold">Profile purpose<select disabled={!ownLeadership} className={input} value={profile.profileKind} onChange={e => change({ profileKind: e.target.value as ProfileKind })}>{Object.entries(profileKindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <p className="text-sm text-[var(--fc-text-secondary)]">Professional profiles focus on teams, news, history and associated academies. Academy profiles put training and family information first. Community profiles support amateur and school clubs.</p>
                <div className="space-y-4"><h3 className="font-bold">Training programmes & prices</h3>
                    {profile.programmes.map((p, index) => <section key={p.id ?? `new-${index}`} aria-label={`Programme ${index + 1}`} className="space-y-4 rounded-lg border border-[var(--fc-border)] p-4">
                        <div className="flex justify-between gap-3"><h4 className="font-semibold">Programme {index + 1}</h4><button type="button" className="text-sm app-text-action" onClick={() => change({ programmes: profile.programmes.filter((_, i) => i !== index) })}>Remove programme</button></div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm">Programme name<input className={input} required maxLength={120} value={p.name} onChange={e => programme(index, { name: e.target.value })} /></label>
                            <label className="text-sm">Sessions per week<input className={input} type="number" min={1} max={14} value={p.sessionsPerWeek ?? ''} onChange={e => programme(index, { sessionsPerWeek: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label className="text-sm">Minimum age<input className={input} type="number" min={0} max={99} value={p.ageMin ?? ''} onChange={e => programme(index, { ageMin: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label className="text-sm">Maximum age<input className={input} type="number" min={p.ageMin ?? 0} max={99} value={p.ageMax ?? ''} onChange={e => programme(index, { ageMax: e.target.value ? Number(e.target.value) : null })} /></label>
                            <label className="text-sm">Price status<select className={input} value={p.priceType} onChange={e => programme(index, { priceType: e.target.value as TrainingProgramme['priceType'], amount: null })}><option value="FIXED">Fixed price</option><option value="FREE">Free training</option><option value="VARIES">Price varies</option><option value="UNPUBLISHED">Hide fees</option></select></label>
                            {p.priceType === 'FIXED' && <label className="text-sm">Training amount<input className={input} required type="number" min="0.01" max="9999999999.99" step="0.01" value={p.amount ?? ''} onChange={e => programme(index, { amount: e.target.value || null })} /></label>}
                            <label className="text-sm">Currency<select required={p.priceType!=="UNPUBLISHED"||p.trialAmount!==null||p.joiningFee!==null||p.equipmentFee!==null} className={input} value={p.currency} onChange={e => programme(index, { currency: e.target.value })}><option value="">Choose currency</option>{Array.from(new Set(['GEL', 'EUR', 'GBP', 'USD', p.currency])).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></label>
                            <label className="text-sm">Billing period<select className={input} value={p.billingPeriod} onChange={e => programme(index, { billingPeriod: e.target.value as TrainingProgramme['billingPeriod'] })}><option value="MONTH">Per month</option><option value="SESSION">Per session</option><option value="TERM">Per term</option><option value="YEAR">Per year</option><option value="ONE_OFF">One-off</option></select></label>
                            {(['trialAmount', 'joiningFee', 'equipmentFee'] as const).map(field => <label key={field} className="text-sm">{{ trialAmount: 'Trial session fee', joiningFee: 'Joining fee', equipmentFee: 'Equipment fee' }[field]}<input className={input} type="number" min="0" max="9999999999.99" step="0.01" value={p[field] ?? ''} onChange={e => programme(index, { [field]: e.target.value || null })} /></label>)}
                            <label className="text-sm sm:col-span-2">What is included & practical information<textarea className={input} rows={3} maxLength={2000} value={p.details ?? ''} onChange={e => programme(index, { details: e.target.value || null })} /></label>
                            <label className="text-sm">Fee valid from<input type="date" className={input} value={p.validFrom??''} onChange={e=>programme(index,{validFrom:e.target.value||null,squadIds:p.squadIds??[]})}/></label>
                            <label className="text-sm">Fee valid until<input type="date" min={p.validFrom??undefined} className={input} value={p.validUntil??''} onChange={e=>programme(index,{validUntil:e.target.value||null,squadIds:p.squadIds??[]})}/></label>
                            <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold">Programme squads</legend><p className="my-2 text-xs">Select the squads this offer covers. Create separate programmes when their fees differ.</p><div className="flex flex-wrap gap-4">{squads.map(s=><label className="flex items-center gap-2 text-sm" key={s.id}><input type="checkbox" checked={p.squadIds?.includes(s.id)??false} onChange={e=>programme(index,{squadIds:e.target.checked?[...(p.squadIds??[]),s.id]:(p.squadIds??[]).filter(id=>id!==s.id)})}/>{s.name}</label>)}</div></fieldset>
                        </div>
                        <p className="text-xs text-[var(--fc-text-secondary)]">All fees use the selected currency. Enter 0 for no charge; leave a fee blank when it has not been published.</p>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.published} onChange={e => programme(index, { published: e.target.checked })} />Publish programme</label>
                        <p className="text-xs text-[var(--fc-text-secondary)]">Linked squads show their scheduled training dates and times so families can compare before joining. Private session details stay restricted. A squad’s explicit private timetable setting takes priority.</p>
                    </section>)}
                    <button type="button" className={button} disabled={profile.programmes.length >= 30} onClick={() => change({ programmes: [...profile.programmes, emptyProgramme()] })}>Add training programme</button>
                </div>
                <div className="space-y-4"><h3 className="font-bold">Sponsors</h3><p className="text-sm text-[var(--fc-text-secondary)]">Sponsors appear on this club's page only. They do not need a GrassKickZ account.</p>
                    {profile.sponsors.map((s, index) => <section key={s.id ?? `new-${index}`} aria-label={`Sponsor ${index + 1}`} className="space-y-4 rounded-lg border border-[var(--fc-border)] p-4">
                        <div className="flex justify-between"><h4 className="font-semibold">Sponsor {index + 1}</h4>{!s.promotionBlocked && <button type="button" className="text-sm app-text-action" onClick={() => change({ sponsors: profile.sponsors.filter((_, i) => i !== index) })}>Remove sponsor</button>}</div>
                        {s.promotionBlocked ? <><p className="text-sm" role="status">{(i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka') ? 'საჯარო გამოჩენა შეზღუდულია. ჩანაწერი და ისტორია შენარჩუნებულია; შეგიძლიათ გამორთოთ გამოქვეყნების მოთხოვნა.' : 'Public promotion is restricted. The record and history are retained; you can turn off its publication request.'}</p><p>{s.name}</p></> : <>
                            <label className="block text-sm">Sponsor name<input className={input} required maxLength={255} value={s.name} onChange={e => sponsor(index, { name: e.target.value })} /></label>
                            <ImageUploadField label="Sponsor logo" max={1} context="logo" images={s.logoUrl ? [s.logoUrl] : []} onChange={images => sponsor(index, { logoUrl: images[0] ?? null })} onBusyChange={setUploading}/>
                            <label className="block text-sm">Website<input className={input} type="url" maxLength={500} placeholder="https://…" value={s.websiteUrl ?? ''} onChange={e => sponsor(index, { websiteUrl: e.target.value || null })} /></label>
                        </>}
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.published} disabled={s.promotionBlocked && !s.published} onChange={e => sponsor(index, { published: e.target.checked })} />{s.promotionBlocked ? ((i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka') ? 'გამოქვეყნება მოთხოვნილია (შეზღუდული)' : 'Publication requested (restricted)') : 'Publish sponsor'}</label>
                    </section>)}
                    <button type="button" className={button} disabled={profile.sponsors.length >= 30} onClick={() => change({ sponsors: [...profile.sponsors, { name: '', logoUrl: null, websiteUrl: null, organizationId: null, published: false }] })}>Add sponsor</button>
                </div>
                <button disabled={!dirty || busy} className="rounded-lg bg-[var(--fc-accent)] px-5 py-3 font-semibold text-[color:var(--color-on-accent)] disabled:opacity-50">{busy ? 'Saving…' : 'Save profile settings'}</button>
            </fieldset>
        </form>
        <section className="space-y-3 border-t border-[var(--fc-border)] pt-5"><h3 className="font-bold">Academy affiliations</h3>
            <p className="text-sm text-[var(--fc-text-secondary)]">An academy can have one confirmed parent club. The other club must accept the request. Academy leadership can separately allow its parent club to edit programmes, prices and sponsors. Private squad information and staff permissions remain separate.</p>
            {dirty && <p className="text-sm">Save your profile changes before managing affiliations.</p>}
            {profile.affiliations.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--fc-border)] p-3"><div><Link className="font-semibold" to={`/clubs/${a.clubId}`}>{a.name}</Link><p className="text-xs">{a.status === 'ACTIVE' ? 'Confirmed affiliation' : a.canRespond ? 'Awaiting your confirmation' : 'Waiting for the other club'}</p></div><div className="flex flex-wrap gap-2">
                {ownLeadership && a.status === 'PENDING' && a.canRespond && <><button className={button} disabled={busy || uploading || dirty} onClick={() => void mutate(() => apiClient.post(`/clubs/${clubId}/presentation/affiliations/${a.id}`, { action: 'ACCEPT' }), 'Affiliation confirmed.')}>Accept</button><button className={button} disabled={busy || uploading || dirty} onClick={() => void mutate(() => apiClient.post(`/clubs/${clubId}/presentation/affiliations/${a.id}`, { action: 'REJECT' }), 'Request declined.')}>Decline</button></>}
                {ownLeadership && (a.status === 'ACTIVE' || !a.canRespond) && <button className={button} disabled={busy || uploading || dirty} onClick={() => void mutate(() => apiClient.post(`/clubs/${clubId}/presentation/affiliations/${a.id}`, { action: 'END' }), 'Affiliation ended or request withdrawn.')}>{a.status === 'ACTIVE' ? 'End affiliation' : 'Withdraw request'}</button>}
                {ownLeadership && profile.profileKind === 'ACADEMY' && a.status === 'ACTIVE' && <button className={button} disabled={busy || uploading || dirty} onClick={() => void mutate(() => apiClient.put(`/clubs/${clubId}/presentation/affiliations/${a.id}/profile-management`, { enabled: !a.profileManagementEnabled }), a.profileManagementEnabled ? 'Parent club profile access revoked.' : 'Parent club can now edit this academy profile.')}>{a.profileManagementEnabled ? 'Revoke profile management' : 'Allow parent club to manage profile'}</button>}
                {a.canManageProfile && <Link className={button} to={`/clubs/${a.clubId}/profile-settings`}>Manage academy profile</Link>}
            </div></div>)}
            {ownLeadership && <><label className="block text-sm">Find {profile.profileKind === 'ACADEMY' ? 'a parent club' : 'an academy'}<input disabled={busy || uploading || dirty} className={input} value={query} onChange={e => { setQuery(e.target.value); setMatches([]); setSearchError(''); }} placeholder="Search by club name" /></label>{searchError && <p role="alert" className="text-sm">{searchError}</p>}{query.trim().length >= 2 && matches.map(c => <button key={c.id} disabled={busy || uploading || dirty} className={`${button} mr-2`} onClick={() => void mutate(() => apiClient.post(`/clubs/${clubId}/presentation/affiliations`, { clubId: c.id }), 'Affiliation request sent to the other club.')}>Request affiliation with {c.name}</button>)}</>}
        </section>
    </section>;
};


