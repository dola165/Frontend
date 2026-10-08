import {competitionInstant} from '../features/competitions/competitionTime';
import {CompetitionVenuePicker} from '../features/competitions/CompetitionVenuePicker';
import {CompetitionBannerField} from '../features/competitions/CompetitionBannerField';
import { CompetitionRulesForm } from '../features/competitions/CompetitionRulesForm';
import { CompetitionPolicyForm } from '../features/competitions/CompetitionPolicyForm';
import { defaultPolicy, type EligibilityPolicy } from '../features/competitions/api';
import { createCompetition, defaultRules, familyLabels, structureLabels, type CompetitionRules, type Family } from '../features/competitions/api';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, ChevronRight, Eye, Loader2, LockKeyhole, Trophy, Users } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchMyOrganizations, fetchTournamentHostClubs } from '../features/tournaments/api';
import type { CreateTournamentPayload, MyOrganization, TournamentHostClubOption, TournamentParticipantScope, TournamentVisibility } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { readOrganizerSelection, readTournamentSetupDraft, type TournamentFormState, type TournamentSetupDraft } from '../features/tournaments/setupDraft';
import { tournamentSetupCopy } from '../features/tournaments/tournamentSetupCopy';
import './tournament-setup.css';
import {isAxiosError} from 'axios';
import {readIntent,writeIntent} from '../features/competitions/commandRecovery';

const blankToNull = (value: string) => value.trim() || null;
const buildInitialForm = (): TournamentFormState => ({
    hostClubId: '', venueId:'',bannerImageUrl:'',name: '', description: '', rules: '', participantScope: 'CLUB', visibility: 'PRIVATE',
    registrationOpensAt: '', registrationClosesAt: '', startDate: '', endDate: '',
});

export const TournamentSetupPage = () => {
    const {user,sessionId}=useAuth();
    return <TournamentSetupContent key={`${user?.id}:${sessionId}`}/>;
};
const TournamentSetupContent = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user,sessionId } = useAuth();
    const { i18n } = useTranslation();
    const copy = tournamentSetupCopy(i18n.resolvedLanguage ?? i18n.language);
    const draftKey=`competition-draft:${user?.id}:${sessionId}`;
    const restoredDraft = useMemo(()=>{let stored:unknown;try{stored=JSON.parse(sessionStorage.getItem(draftKey)||'null');}catch{/* Ignore invalid or unavailable storage. */}return readTournamentSetupDraft(location.state,user?.id)??readTournamentSetupDraft(stored,user?.id);},[draftKey,location.state,user?.id]);
    const requestedOrganizerId = readOrganizerSelection(new URLSearchParams(location.search).get('organizer'));
    const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
    const [organizationsAttempt, setOrganizationsAttempt] = useState(0);
    const [organizationsLoading, setOrganizationsLoading] = useState(true);
    const [organizationsError, setOrganizationsError] = useState<string | null>(null);
    const [selectedOrganizerId, setSelectedOrganizerId] = useState<number | null>(() => requestedOrganizerId ?? restoredDraft?.organizerId ?? null);
    const [hostClubs, setHostClubs] = useState<TournamentHostClubOption[]>([]);
    const [hostClubsLoading, setHostClubsLoading] = useState(false);
    const [hostClubsError, setHostClubsError] = useState<string | null>(null);
    const [hostClubsAttempt, setHostClubsAttempt] = useState(0);
    const [form, setForm] = useState<TournamentFormState>(() => restoredDraft?.form ?? buildInitialForm());
    const [competitionRules, setCompetitionRules] = useState<CompetitionRules>(() => restoredDraft?.competitionRules ?? defaultRules((['LEAGUE','CUP','LADDER','FESTIVAL'].includes(new URLSearchParams(location.search).get('family') || '') ? new URLSearchParams(location.search).get('family') : 'CUP') as Family));
    const [pendingCreation,setPendingCreation]=useState(()=>readIntent(`${draftKey}:create`));
    useEffect(()=>{const refresh=()=>setPendingCreation(readIntent(`${draftKey}:create`));window.addEventListener('competition-intent',refresh);return()=>window.removeEventListener('competition-intent',refresh);},[draftKey]);
    const creationIdentity = useRef<{ payload: string; requestId: string }>(null);
    const [eligibilityPolicy,setEligibilityPolicy]=useState<EligibilityPolicy>(()=>restoredDraft?.eligibilityPolicy??defaultPolicy());
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const formElement = useRef<HTMLFormElement>(null);
    const requestPending = useRef(false);
    const mounted = useRef(true);
    const completed=useRef(false);
    useEffect(()=>{
        if(!user||completed.current)return;
        const draft: TournamentSetupDraft={accountId:user.id,organizerId:selectedOrganizerId,form,competitionRules,eligibilityPolicy};
        try{sessionStorage.setItem(draftKey,JSON.stringify({tournamentSetupDraft:draft}));}catch{/* The current form remains usable if storage is disabled. */}
        const warn=(event:BeforeUnloadEvent)=>{if(!completed.current&&form.name.trim()){event.preventDefault();event.returnValue='';}};
        window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
    },[draftKey,user,selectedOrganizerId,form,competitionRules,eligibilityPolicy]);

    const availableOrganizations = useMemo(() => organizations.filter(organization => organization.canCreateTournament === true), [organizations]);
    const selectedOrganizer = useMemo(() => availableOrganizations.find(organization => organization.id === selectedOrganizerId) ?? null, [availableOrganizations, selectedOrganizerId]);
    const selectedHostClub = useMemo(() => hostClubs.find(club => String(club.clubId) === form.hostClubId) ?? null, [hostClubs, form.hostClubId]);
    const [imageBusy,setImageBusy]=useState(false);
    const blocked = imageBusy || saving || organizationsLoading || selectedOrganizer == null || (Boolean(form.hostClubId) && hostClubsLoading);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        let active = true;
        setOrganizationsLoading(true);
        setOrganizationsError(null);
        void fetchMyOrganizations().then(data => {
            if (!active) return;
            setOrganizations(data);
            setSelectedOrganizerId(current => data.some(organization => organization.id === current && organization.canCreateTournament === true)
                ? current : data.find(organization => organization.canCreateTournament === true)?.id ?? null);
        }).catch(err => {
            if (!active) return;
            setOrganizations([]);
            setSelectedOrganizerId(null);
            setOrganizationsError(extractApiErrorMessage(err, copy.organizationsError));
        }).finally(() => { if (active) setOrganizationsLoading(false); });
        return () => { active = false; };
    }, [organizationsAttempt, user?.id, copy.organizationsError]);

    const openOrganizationCreation = () => {
        if (user?.id == null || saving) return;
        const tournamentSetupDraft: TournamentSetupDraft = { accountId: user.id, organizerId: selectedOrganizerId, form, competitionRules, eligibilityPolicy };
        const state = { tournamentSetupDraft };
        // Preserve the draft on both the explicit return and the browser's Back action.
        navigate(location.pathname + location.search, { replace: true, state });
        navigate('/organizations/create', { state });
    };

    useEffect(() => {
        let active = true;
        if (selectedOrganizerId == null || organizationsLoading || selectedOrganizer?.canCreateTournament !== true) {
            setHostClubs([]);
            setHostClubsError(null);
            setHostClubsLoading(false);
            return () => { active = false; };
        }
        setHostClubs([]);
        setHostClubsLoading(true);
        setHostClubsError(null);
        void fetchTournamentHostClubs(selectedOrganizerId).then(data => {
            if (!active) return;
            setHostClubs(data);
            setForm(current => data.some(club => String(club.clubId) === current.hostClubId) ? current : { ...current, hostClubId: '' });
        }).catch(err => {
            if (active) { setHostClubs([]); setHostClubsError(extractApiErrorMessage(err, copy.hostClubsError)); }
        }).finally(() => { if (active) setHostClubsLoading(false); });
        return () => { active = false; };
    }, [selectedOrganizerId, organizationsLoading, selectedOrganizer?.canCreateTournament, hostClubsAttempt, copy.hostClubsError]);

    const update = <K extends keyof TournamentFormState>(key: K, value: TournamentFormState[K]) => {
        setForm(current => ({ ...current, [key]: value }));
        setError(null);
    };
    const showStep = (next: number) => {
        setStep(next);
        formElement.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    };
    const failValidation = (message: string, field: string, targetStep: number) => {
        setError(message);
        showStep(targetStep);
        requestAnimationFrame(() => formElement.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus());
        return false;
    };
    const validate = (includeDetails: boolean) => {
        if (!selectedOrganizer) return failValidation(copy.organizerRequired, 'organizer', 0);
        if (!form.name.trim()) return failValidation(copy.nameRequired, 'name', 0);
        if (!form.startDate) return failValidation(copy.startRequired, 'startDate', 0);
        if (!form.endDate) return failValidation(copy.endRequired, 'endDate', 0);
        try{
        if (competitionInstant(form.startDate,competitionRules.timezone).getTime() <= Date.now()) return failValidation(copy.futureStart, 'startDate', 0);
        if (competitionInstant(form.endDate,competitionRules.timezone).getTime() <= Date.now()) return failValidation(copy.futureEnd, 'endDate', 0);
        }catch(cause){return failValidation(extractApiErrorMessage(cause,'Choose a valid unambiguous date in the competition time zone.'),'startDate',0);}
        if (form.endDate < form.startDate) return failValidation(copy.dateOrder, 'endDate', 0);
        if (!includeDetails) return true;
        if (form.registrationOpensAt && form.registrationClosesAt && form.registrationClosesAt < form.registrationOpensAt) {
            return failValidation(copy.registrationOrder, 'registrationClosesAt', 1);
        }
        if (form.registrationClosesAt && form.registrationClosesAt > form.startDate) {
            return failValidation(copy.registrationBeforeStart, 'registrationClosesAt', 1);
        }
        if (form.hostClubId && !selectedHostClub) return failValidation(copy.hostRequired, 'hostClubId', 1);
        if (includeDetails && (!competitionRules.ruleset.trim() || !competitionRules.seasonPolicy.trim() || competitionRules.ageGroup.startsWith('U') && !competitionRules.ageCutoff)) return failValidation('State the ruleset, season policy and any required youth age cutoff.', 'ruleset', 1);
        if(includeDetails&&competitionRules.matchMinutes>eligibilityPolicy.maximumMatchMinutes)return failValidation('Match length exceeds the published age/ruleset limit.','matchMinutes',1);
        if(includeDetails&&form.participantScope==='PLAYER'&&competitionRules.ageGroup.startsWith('U')&&Number(competitionRules.ageGroup.slice(1))<=18)return failValidation('Youth competitions use supervised club or squad entries. Individual registration currently requires an adult player.','participantScope',0);
        return true;
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (blocked || requestPending.current || !validate(step > 0)) return;
        if (step < 2) { showStep(step + 1); return; }
        if (selectedOrganizerId == null) return;
        requestPending.current = true;
        setSaving(true);
        setError(null);
        const payload: CreateTournamentPayload = {
            organizerOrganizationId: selectedOrganizerId,
            hostClubId: form.hostClubId ? Number(form.hostClubId) : null,
            name: form.name.trim(), description: blankToNull(form.description), rules: blankToNull(form.rules),
            participantScope: form.participantScope, visibility: form.visibility,
            registrationOpensAt: form.registrationOpensAt || null, registrationClosesAt: form.registrationClosesAt || null,
            startDate: form.startDate, endDate: form.endDate, locationId: null,bannerImageUrl:form.bannerImageUrl||null,
        };
        try {
            const key = JSON.stringify({payload,competitionRules,eligibilityPolicy,venueId:form.venueId||null});
            const stored=readIntent(`${draftKey}:create`);
            if(stored&&stored.key!==key)throw new Error('The earlier creation still needs confirmation. Restore its saved draft and retry before changing the submitted details.');
            if(stored?.key===key)creationIdentity.current={payload:key,requestId:stored.requestId};
            if (creationIdentity.current?.payload !== key) creationIdentity.current = {payload:key,requestId:crypto.randomUUID()};
            writeIntent(`${draftKey}:create`,{key,requestId:creationIdentity.current.requestId,revision:0});
            const tournament = await createCompetition(payload, competitionRules, creationIdentity.current.requestId,eligibilityPolicy,form.venueId?Number(form.venueId):null);
            writeIntent(`${draftKey}:create`,undefined);completed.current=true;
            try{sessionStorage.removeItem(draftKey);}catch{/* Creation is already recorded on the server. */}
            if (mounted.current) navigate(`/tournaments/${tournament.id}/workspace`);
        } catch (err) {
            if(isAxiosError(err)&&err.response&&err.response.status<500){creationIdentity.current=null;writeIntent(`${draftKey}:create`,undefined);}
            if (mounted.current) setError(extractApiErrorMessage(err, copy.createError));
        } finally {
            requestPending.current = false;
            if (mounted.current) setSaving(false);
        }
    };

    const recoverCreation=async()=>{
        if(!pendingCreation||requestPending.current)return;
        requestPending.current=true;setSaving(true);setError(null);
        try{
            const saved=JSON.parse(pendingCreation.key) as {payload:CreateTournamentPayload;competitionRules:CompetitionRules;eligibilityPolicy:EligibilityPolicy;venueId:string|null};
            if(!saved.payload||!Number.isSafeInteger(saved.payload.organizerOrganizationId)||!saved.competitionRules||!saved.eligibilityPolicy)throw new Error('The saved creation is unavailable.');
            const tournament=await createCompetition(saved.payload,saved.competitionRules,pendingCreation.requestId,saved.eligibilityPolicy,saved.venueId?Number(saved.venueId):null);
            writeIntent(`${draftKey}:create`,undefined);completed.current=true;
            try{sessionStorage.removeItem(draftKey);}catch{/* The acknowledged result is already saved. */}
            if(mounted.current)navigate(`/tournaments/${tournament.id}/workspace`);
        }catch(err){
            if(isAxiosError(err)&&err.response&&err.response.status<500)writeIntent(`${draftKey}:create`,undefined);
            if(mounted.current)setError(extractApiErrorMessage(err,copy.createError));
        }finally{requestPending.current=false;if(mounted.current)setSaving(false);}
    };

    const formatDate = (value: string) => {try{return value ? competitionInstant(value,competitionRules.timezone).toLocaleString(i18n.resolvedLanguage === 'ka' ? 'ka-GE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',timeZone:competitionRules.timezone }) : copy.notSet;}catch{return copy.notSet;}};
    const scopeLabels: Record<TournamentParticipantScope, string> = { CLUB: copy.clubs, SQUAD: copy.squads, PLAYER: copy.players };
    const visibilityLabels: Record<TournamentVisibility, string> = { PRIVATE: copy.private, PUBLIC: copy.public, UNLISTED: copy.unlisted };
    const visibilityHints: Record<TournamentVisibility, string> = { PRIVATE: copy.privateHint, PUBLIC: copy.publicHint, UNLISTED: copy.unlistedHint };

    return <div className="tournament-setup">
        <header className="tournament-setup__header">
            <Link to="/tournaments" className="tournament-setup__back"><ArrowLeft size={16} aria-hidden="true" />{copy.browse}</Link>
            <p className="tournament-setup__eyebrow">{copy.eyebrow}</p>
            <h1>{i18n.language.startsWith('ka') ? 'შეჯიბრების შექმნა' : 'Create a competition'}</h1>
            <p>{copy.intro}</p>
        </header>
        {pendingCreation&&<aside className="tournament-setup__error" role="status"><p>{i18n.language.startsWith('ka')?'წინა შექმნის დადასტურება მოლოდინშია. გადაამოწმეთ თავდაპირველად გაგზავნილი მონაცემები, სანამ ახალ შეჯიბრებას შექმნით.':'Confirmation of the earlier creation is pending. Retry the original submission before creating another competition.'}</p><button type="button" disabled={saving} onClick={()=>void recoverCreation()}>{i18n.language.startsWith('ka')?'წინა შექმნის გადამოწმება':'Recover earlier creation'}</button></aside>}
        <form ref={formElement} className="tournament-setup__editor" aria-label={copy.title} aria-busy={saving || organizationsLoading} noValidate onSubmit={handleSubmit}>
            <nav className="tournament-setup__steps" aria-label={copy.stepsLabel}>
                {[copy.basics, copy.details, copy.review].map((label, index) => <button key={label} type="button" disabled={saving} aria-current={step === index ? 'step' : undefined} onClick={() => { if (index <= step || validate(index > 1)) showStep(index); }}>
                    <span aria-hidden="true">{step > index ? <Check size={15} /> : index + 1}</span><strong>{label}</strong>{index < 2 && <ChevronRight size={15} aria-hidden="true" />}
                </button>)}
            </nav>
            {organizationsLoading ? <div className="tournament-setup__loading" role="status"><Loader2 className="animate-spin" size={22} aria-hidden="true" />{copy.loading}</div>
                : organizationsError ? <div className="tournament-setup__empty" role="alert"><p>{organizationsError}</p><button type="button" className="tournament-setup__button" onClick={() => setOrganizationsAttempt(attempt => attempt + 1)}>{copy.retryOrganizations}</button></div>
                    : <div className="tournament-setup__layout">
                        <fieldset disabled={saving} className="tournament-setup__fields">
                            <section hidden={step !== 0} aria-labelledby="tournament-basics-heading">
                                <div className="tournament-setup__section-heading"><h2 id="tournament-basics-heading">{copy.basicsTitle}</h2><p>{copy.basicsHint}</p></div>
                                <label className="tournament-setup__field"><span>{copy.name}</span><input name="name" value={form.name} onChange={event => update('name', event.target.value)} placeholder={copy.namePlaceholder} maxLength={255} required autoComplete="off" /></label>
                                <div className="tournament-setup__organizer">
                                    {availableOrganizations.length > 0 ? <label className="tournament-setup__field"><span>{copy.organizer}</span><select name="organizer" value={selectedOrganizerId ?? ''} onChange={event => { setSelectedOrganizerId(Number(event.target.value)); update('hostClubId', ''); }}>
                                        {availableOrganizations.map(organization => <option key={organization.id} value={organization.id}>{organization.displayName}</option>)}
                                    </select></label> : <div className="tournament-setup__empty"><Building2 size={24} aria-hidden="true" /><strong>{copy.noOrganizerTitle}</strong><p>{copy.noOrganizer}</p></div>}
                                    <p className="tournament-setup__hint">{copy.organizerHint}</p>
                                    <button type="button" className="tournament-setup__text-button" onClick={openOrganizationCreation}><Building2 size={15} aria-hidden="true" />{copy.createOrganization}</button>
                                </div>
                                <div className="tournament-setup__row">
                                    <label className="tournament-setup__field"><span>{copy.starts}</span><input name="startDate" type="datetime-local" required value={form.startDate} onChange={event => update('startDate', event.target.value)} /></label>
                                    <label className="tournament-setup__field"><span>{copy.ends}</span><input name="endDate" type="datetime-local" required value={form.endDate} min={form.startDate || undefined} onChange={event => update('endDate', event.target.value)} /></label>
                                </div>
                                <label className="tournament-setup__field"><span>{copy.participants}</span><select name="participantScope" value={form.participantScope} onChange={event => update('participantScope', event.target.value as TournamentParticipantScope)}>
                                    <option value="CLUB">{copy.clubs}</option><option value="SQUAD">{copy.squads}</option><option value="PLAYER">{copy.players}</option>
                                </select><small>{copy.participantsHint}</small></label>
                            </section>
                            <section hidden={step !== 1} aria-labelledby="tournament-details-heading">
                                <p>{i18n.language.startsWith('ka')?'შეჯიბრების თარიღები და რეგისტრაციის დრო':'Competition and registration dates use'} · {competitionRules.timezone}</p><CompetitionVenuePicker value={form.venueId||''} onChange={value=>update('venueId',value)} disabled={saving}/><CompetitionBannerField value={form.bannerImageUrl||''} onChange={value=>update('bannerImageUrl',value)} disabled={saving} onBusy={setImageBusy}/><CompetitionRulesForm rules={competitionRules} onChange={setCompetitionRules} disabled={saving} />
                                <CompetitionPolicyForm policy={eligibilityPolicy} onChange={setEligibilityPolicy} disabled={saving}/>
                                <div className="tournament-setup__section-heading"><h2 id="tournament-details-heading">{copy.detailsTitle}<span>{copy.optional}</span></h2><p>{copy.detailsHint}</p></div>
                                <label className="tournament-setup__field"><span>{copy.description}</span><textarea name="description" rows={3} value={form.description} maxLength={4000} onChange={event => update('description', event.target.value)} placeholder={copy.descriptionPlaceholder} /></label>
                                <label className="tournament-setup__field"><span>{copy.rules}</span><textarea name="rules" rows={3} value={form.rules} maxLength={10000} onChange={event => update('rules', event.target.value)} placeholder={copy.rulesPlaceholder} /></label>
                                <div className="tournament-setup__divider"><h3>{copy.registration}</h3><p>{copy.registrationHint}</p></div>
                                <div className="tournament-setup__row">
                                    <label className="tournament-setup__field"><span>{copy.registrationOpens}</span><input name="registrationOpensAt" type="datetime-local" value={form.registrationOpensAt} onChange={event => update('registrationOpensAt', event.target.value)} /></label>
                                    <label className="tournament-setup__field"><span>{copy.registrationCloses}</span><input name="registrationClosesAt" type="datetime-local" value={form.registrationClosesAt} min={form.registrationOpensAt || undefined} max={form.startDate || undefined} onChange={event => update('registrationClosesAt', event.target.value)} /></label>
                                </div>
                                <label className="tournament-setup__field"><span>{copy.hostClub}</span><select name="hostClubId" value={form.hostClubId} disabled={hostClubsLoading || selectedOrganizerId == null} onChange={event => update('hostClubId', event.target.value)}>
                                    <option value="">{copy.noHostClub}</option>{hostClubs.map(club => <option key={club.clubId} value={club.clubId}>{club.clubName}</option>)}
                                </select><small>{copy.hostHint}</small></label>
                                {hostClubsLoading && <p role="status" className="tournament-setup__hint">{copy.loadingHostClubs}</p>}
                                {hostClubsError && <div role="alert" className="tournament-setup__host-error"><p>{hostClubsError}</p><button type="button" className="tournament-setup__text-button" onClick={() => setHostClubsAttempt(attempt => attempt + 1)}>{copy.retryHostClubs}</button></div>}
                            </section>
                            <section hidden={step !== 2} aria-labelledby="tournament-review-heading">
                                <div className="tournament-setup__section-heading"><h2 id="tournament-review-heading">{copy.reviewTitle}</h2><p>{copy.reviewHint}</p></div>
                                <dl className="tournament-setup__review">
                                    <div><dt>Competition</dt><dd>{familyLabels[competitionRules.family]} · {structureLabels[competitionRules.structure]}</dd></div>
                                    <div><dt>Playing rules</dt><dd>{competitionRules.discipline} · {competitionRules.sideSize}v{competitionRules.sideSize} · {competitionRules.ageGroup} · {competitionRules.ruleset}</dd></div>
                                    <div><dt>Match timetable</dt><dd>{competitionRules.matchMinutes} min, {competitionRules.restMinutes} min rest, {competitionRules.pitches} pitches · {competitionRules.timezone}</dd></div>
                                    <div><dt>Entry fee</dt><dd>{competitionRules.entryFee} {competitionRules.currency} / {competitionRules.feeBasis.toLowerCase()}</dd></div>
                                    <div><dt>Season policy</dt><dd>{competitionRules.seasonPolicy}</dd></div>
                                    <div><dt>{copy.name}</dt><dd>{form.name || copy.notSet}</dd></div>
                                    <div><dt>{copy.organizer}</dt><dd>{selectedOrganizer?.displayName ?? copy.notSet}</dd></div>
                                    <div><dt>{copy.starts}</dt><dd>{formatDate(form.startDate)}</dd></div>
                                    <div><dt>{copy.ends}</dt><dd>{formatDate(form.endDate)}</dd></div>
                                    <div><dt>{copy.participants}</dt><dd>{scopeLabels[form.participantScope]}</dd></div>
                                    {selectedHostClub && <div><dt>{copy.hostClub}</dt><dd>{selectedHostClub.clubName}</dd></div>}
                                    {form.registrationOpensAt && <div><dt>{copy.registrationOpens}</dt><dd>{formatDate(form.registrationOpensAt)}</dd></div>}
                                    {form.registrationClosesAt && <div><dt>{copy.registrationCloses}</dt><dd>{formatDate(form.registrationClosesAt)}</dd></div>}
                                </dl>
                                {(form.description || form.rules) && <details className="tournament-setup__written-review"><summary>{copy.readDetails}</summary>{form.description && <p>{form.description}</p>}{form.rules && <><h3>{copy.rules}</h3><p>{form.rules}</p></>}</details>}
                                <label className="tournament-setup__field"><span>{copy.visibility}</span><select name="visibility" value={form.visibility} onChange={event => update('visibility', event.target.value as TournamentVisibility)} aria-describedby="tournament-visibility-hint">
                                    <option value="PRIVATE">{copy.private}</option><option value="PUBLIC">{copy.public}</option><option value="UNLISTED">{copy.unlisted}</option>
                                </select><small id="tournament-visibility-hint">{visibilityHints[form.visibility]}</small></label>
                                <div className="tournament-setup__next"><Trophy size={20} aria-hidden="true" /><div><h3>{copy.nextTitle}</h3><p>{copy.nextHint}</p></div></div>
                            </section>
                        </fieldset>
                        <aside className="tournament-setup__preview" aria-label={copy.previewLabel}>
                            <div className="tournament-setup__preview-icon"><Trophy size={25} aria-hidden="true" /></div>
                            <p className="tournament-setup__eyebrow">{copy.previewTitle}</p><h2>{form.name.trim() || copy.previewName}</h2>
                            <p className="tournament-setup__preview-organizer">{selectedOrganizer?.displayName ?? copy.previewOrganizer}</p>
                            <ul><li><CalendarDays size={16} aria-hidden="true" /><span>{formatDate(form.startDate)}</span></li><li><Users size={16} aria-hidden="true" /><span>{scopeLabels[form.participantScope]}</span></li><li>{form.visibility === 'PRIVATE' ? <LockKeyhole size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}<span>{visibilityLabels[form.visibility]}</span></li></ul>
                            <p className="tournament-setup__preview-note">{copy.previewHint}</p>
                        </aside>
                    </div>}
            {error && <div className="tournament-setup__error" role="alert">{error}</div>}
            <footer className="tournament-setup__footer">
                <p>{step === 2 ? visibilityHints[form.visibility] : copy.footerHint}</p>
                <div>{step > 0 && <button type="button" className="tournament-setup__button" disabled={saving} onClick={() => showStep(step - 1)}><ArrowLeft size={15} aria-hidden="true" />{copy.back}</button>}
                    <button type="submit" className="tournament-setup__button tournament-setup__button--primary" disabled={blocked}>{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}{saving ? copy.creating : step === 0 ? copy.continue : step === 1 ? copy.reviewAction : copy.create}{!saving && step < 2 && <ArrowRight size={16} aria-hidden="true" />}</button></div>
            </footer>
        </form>
    </div>;
};
