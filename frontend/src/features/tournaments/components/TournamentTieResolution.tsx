import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { AlertTriangle, CheckCircle2, ChevronRight, History, Loader2, LockKeyhole, RefreshCw, Scale, ShieldAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialogFocus } from '../../../components/workspace/useDialogFocus';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchTournamentTieHistory, fetchTournamentTieState, resolveTournamentTie } from '../api';
import { buildTournamentTieResolution, type TournamentDetail, type TournamentTieContest, type TournamentTieDecision, type TournamentTieState } from '../domain';
import { participantName } from '../participantLabels';
import './tournament-tie-resolution.css';

interface Props {
    tournament: TournamentDetail;
    canResolve: boolean;
    canAudit?: boolean;
    enabled?: boolean;
    refreshKey?: number | string;
    onResolved?: () => void | Promise<void>;
    onStateChange?: (state: TournamentTieState | null) => void;
}

interface Draft {
    contest: TournamentTieContest;
    selectedEntryId: number | null;
    note: string;
    review: boolean;
    stale: boolean;
    error: string;
}

const invalidationCopy: Record<string, string> = {
    FIXTURE_CHANGED: 'A match result or participant changed.',
    RULES_CHANGED: 'The Competition rules changed.',
    STAGE_RULES_CHANGED: 'The stage rules or structure changed.',
    ELIGIBILITY_CHANGED: 'A contender’s eligibility changed.',
    SEED_CHANGED: 'A contender’s seed changed.',
};

const contestLocation = (contest: TournamentTieContest, tournament: TournamentDetail) => {
    const stage = tournament.stages.find(item => item.id === contest.stageId);
    const fixture = contest.fixtureId == null ? null : tournament.fixtures.find(item => item.id === contest.fixtureId);
    if (contest.key === 'CHAMPION') return 'Tournament winner';
    if (fixture) return `${stage?.name ?? fixture.stageName ?? `Stage ${contest.stageId}`} · Match ${fixture.fixtureOrder ?? fixture.id}`;
    return `${stage?.name ?? `Stage ${contest.stageId}`}${contest.rank == null ? '' : ` · position ${contest.rank}`}`;
};

const consequence = (contest: TournamentTieContest) => {
    if (!contest.consequential) return 'This tie is recorded for transparency but does not block progression.';
    if (contest.key === 'CHAMPION') return 'Winner declaration and Competition completion are blocked.';
    if (contest.fixtureId != null) return 'The winner cannot advance to the next knockout match.';
    return 'Qualification, seeding, and downstream advancement are blocked.';
};

const entryLabel = (tournament: TournamentDetail, id: number) => {
    const label = participantName(tournament.entries.find(entry => entry.id === id));
    return label === '—' ? `Entry #${id}` : label;
};

export const TournamentTieBlockerBanner = ({ state, tournament }: { state: TournamentTieState | null; tournament: TournamentDetail }) => {
    if (!state?.blocked) return null;
    const unresolved = state.contests.filter(contest => contest.consequential && contest.status === 'UNRESOLVED');
    const stageNames = [...new Set([...state.staleStageIds, ...state.blockedStageIds])]
        .map(id => tournament.stages.find(stage => stage.id === id)?.name ?? `Stage ${id}`);
    return <div className="ttr-banner" role="status">
        <ShieldAlert aria-hidden="true" />
        <div><strong>Competition progression is blocked</strong><p>{unresolved.length
            ? `${unresolved.length} consequential ${unresolved.length === 1 ? 'tie needs' : 'ties need'} an authoritative decision.`
            : 'A previous decision no longer matches the current results, rules, or eligibility.'} {stageNames.length ? `Affected: ${stageNames.join(', ')}.` : ''}</p></div>
    </div>;
};

export function TournamentTieResolution({ tournament, canResolve, canAudit = canResolve, enabled = true, refreshKey = 0, onResolved, onStateChange }: Props) {
    const { i18n } = useTranslation();
    const ka = i18n.language.startsWith('ka');
    const copy = useCallback((en: string, translated: string) => ka ? translated : en, [ka]);
    const [state, setState] = useState<TournamentTieState | null>(null);
    const [history, setHistory] = useState<TournamentTieDecision[]>([]);
    const [loading, setLoading] = useState(enabled);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(draft != null, dialogRef, () => { if (!submitting) setDraft(null); });

    const applyState = useCallback((value: TournamentTieState | null) => {
        setState(value);
        onStateChange?.(value);
    }, [onStateChange]);

    const load = useCallback(async (quiet = false) => {
        if (!enabled) {
            applyState(null);
            setLoading(false);
            return;
        }
        if (!quiet) setLoading(true);
        setRefreshing(true);
        setLoadError('');
        try {
            const nextState = await fetchTournamentTieState(tournament.id);
            applyState(nextState);
            if (canAudit) {
                try { setHistory(await fetchTournamentTieHistory(tournament.id)); }
                catch (error) { setLoadError(extractApiErrorMessage(error, copy('The decision audit could not be loaded.', 'გადაწყვეტილებების ისტორია ვერ ჩაიტვირთა.'))); }
            } else setHistory([]);
        } catch (error) {
            applyState(null);
            setLoadError(extractApiErrorMessage(error, copy('Tie status could not be loaded.', 'ფრეების სტატუსი ვერ ჩაიტვირთა.')));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [applyState, canAudit, copy, enabled, tournament.id]);

    useEffect(() => { void load(); }, [load, refreshKey]);

    const begin = (contest: TournamentTieContest) => setDraft({ contest, selectedEntryId: null, note: '', review: false, stale: false, error: '' });
    const review = () => {
        if (!draft || draft.stale || !canResolve || draft.selectedEntryId == null) return;
        try {
            buildTournamentTieResolution(draft.contest, draft.selectedEntryId, draft.note);
            setDraft({ ...draft, note: draft.note.trim(), review: true, error: '' });
        } catch (error) {
            setDraft({ ...draft, error: error instanceof Error ? error.message : copy('Review the decision details.', 'გადაამოწმეთ გადაწყვეტილების დეტალები.') });
        }
    };
    const confirm = async () => {
        if (!draft || draft.stale || !draft.review || !canResolve || draft.selectedEntryId == null || submitting) return;
        setSubmitting(true);
        setDraft(current => current ? { ...current, error: '' } : current);
        try {
            const nextState = await resolveTournamentTie(tournament.id, draft.contest, draft.selectedEntryId, draft.note);
            applyState(nextState);
            if (canAudit) setHistory(await fetchTournamentTieHistory(tournament.id));
            await onResolved?.();
            setDraft(null);
        } catch (error) {
            const stale = isAxiosError(error) && error.response?.status === 409;
            setDraft(current => current ? {
                ...current,
                stale,
                error: stale
                    ? copy('This tie changed before confirmation. Your selection and reason are still here; review the refreshed state below.', 'დადასტურებამდე ფრეს მდგომარეობა შეიცვალა. არჩევანი და მიზეზი შენარჩუნებულია; ქვემოთ განახლებული მდგომარეობა გადაამოწმეთ.')
                    : extractApiErrorMessage(error, copy('The decision could not be recorded.', 'გადაწყვეტილება ვერ ჩაიწერა.')),
            } : current);
            if (stale) await load(true);
        } finally {
            setSubmitting(false);
        }
    };

    const returnToCurrentDraft = () => {
        if (!draft || refreshing || submitting) return;
        if (!state || loadError) { void load(true); return; }
        const current = state.contests.find(contest => contest.key === draft.contest.key);
        if (!current || current.status !== 'UNRESOLVED' || !current.consequential || !current.readyForResolution) {
            setDraft({ ...draft, error: copy('This tie is no longer available for a decision. Your reason is retained below; close this draft and review the current status.', 'ამ ფრეს გადაწყვეტა აღარ არის ხელმისაწვდომი. მიზეზი ქვემოთ შენარჩუნებულია; დახურეთ მონახაზი და გადაამოწმეთ მიმდინარე სტატუსი.') });
            return;
        }
        setDraft({ ...draft, contest: current, selectedEntryId: draft.selectedEntryId != null && current.candidateEntryIds.includes(draft.selectedEntryId) ? draft.selectedEntryId : null, stale: false, review: false, error: '' });
    };

    if (!enabled) return null;
    if (loading) return <div className="ttr-panel ttr-loading" role="status"><Loader2 className="animate-spin" />{copy('Checking authoritative tie status…', 'ფრეების ოფიციალური სტატუსი მოწმდება…')}</div>;
    if (!state && !loadError && !draft) return null;
    const contests = state?.contests ?? [];
    const hasLifecycle = Boolean(state?.blocked || contests.length || history.length);
    if (!hasLifecycle && !loadError && !draft) return null;

    return <section className="ttr-panel" aria-labelledby="tie-resolution-title">
        <header className="ttr-header">
            <div><p className="ttr-eyebrow"><Scale size={14}/>{copy('Authoritative tie state', 'ფრეს ოფიციალური მდგომარეობა')}</p><h2 id="tie-resolution-title">{copy('Tie resolution', 'ფრეს გადაწყვეტა')}</h2></div>
            <button type="button" className="ttr-refresh" onClick={() => void load()} aria-label={copy('Refresh tie status', 'ფრეს სტატუსის განახლება')}><RefreshCw size={15}/></button>
        </header>
        {loadError ? <p className="ttr-error" role="alert">{loadError}</p> : null}
        {state ? <div className={`ttr-state ${state.blocked ? 'is-blocked' : 'is-clear'}`}>
            {state.blocked ? <AlertTriangle/> : <CheckCircle2/>}
            <div><strong>{state.blocked ? copy('A downstream operation is blocked', 'შემდეგი ოპერაცია დაბლოკილია') : copy('Tie decisions are current', 'ფრეს გადაწყვეტილებები აქტუალურია')}</strong>
                <p>{state.blocked ? copy('Use the exact tied contender set below. The server remains the authority for ranking and advancement.', 'გამოიყენეთ ქვემოთ მოცემული ზუსტი მონაწილეთა სია. რეიტინგსა და წინსვლას სერვერი განსაზღვრავს.') : copy('Progression can continue from the current authoritative state.', 'პროგრესი შეიძლება გაგრძელდეს მიმდინარე ოფიციალური მდგომარეობიდან.')}</p></div>
        </div> : null}
        {state && (state.staleStageIds.length > 0 || state.blockedStageIds.length > 0) ? <div className="ttr-recovery">
            <strong>{copy('Prior progression needs recovery', 'წინა პროგრესი აღდგენას საჭიროებს')}</strong>
            {state.staleStageIds.length ? <p>{copy('A prior resolution or advancement was invalidated in:', 'წინა გადაწყვეტილება ან წინსვლა გაუქმდა:')} {state.staleStageIds.map(id => tournament.stages.find(stage => stage.id === id)?.name ?? `Stage ${id}`).join(', ')}.</p> : null}
            {state.blockedStageIds.length ? <p>{copy('Blocked downstream stages:', 'დაბლოკილი შემდეგი ეტაპები:')} {state.blockedStageIds.map(id => tournament.stages.find(stage => stage.id === id)?.name ?? `Stage ${id}`).join(', ')}.</p> : null}
        </div> : null}
        <div className="ttr-contests">
            {contests.map(contest => {
                const selected = contest.selectedEntryId == null ? null : entryLabel(tournament, contest.selectedEntryId);
                return <article className={`ttr-contest ${contest.status === 'UNRESOLVED' && contest.consequential ? 'is-unresolved' : ''}`} key={`${contest.key}:${contest.sourceRevision}`}>
                    <div className="ttr-contest-heading"><div><span>{contest.status === 'RESOLVED' ? copy('Resolved', 'გადაწყვეტილი') : copy('Unresolved tie', 'გადაუწყვეტელი ფრე')}</span><h3>{contestLocation(contest, tournament)}</h3></div><small>{contest.rank == null ? copy('Exact tied set', 'ზუსტი თანაბარი სია') : `${copy('Position', 'პოზიცია')} ${contest.rank}`}</small></div>
                    <div className="ttr-candidates" aria-label={copy('Tied contenders', 'თანაბარი მონაწილეები')}>{contest.candidateEntryIds.map(id => <span className={id === contest.selectedEntryId ? 'is-selected' : ''} key={id}>{entryLabel(tournament, id)} <small>#{id}</small></span>)}</div>
                    <p className="ttr-consequence"><ChevronRight size={14}/><span>{contest.status === 'RESOLVED' && selected ? `${selected} ${copy('was selected. ', 'აირჩა. ')}` : ''}{consequence(contest)}</span></p>
                    <details className="ttr-rules"><summary>{copy('Sporting rules already applied', 'უკვე გამოყენებული სპორტული წესები')}</summary><p>{contest.ruleContext}</p><code>{copy('Source revision', 'წყაროს ვერსია')}: {contest.sourceRevision}</code></details>
                    {contest.status === 'UNRESOLVED' && contest.consequential ? contest.readyForResolution ? (
                        canResolve ? <button type="button" className="ttr-primary" onClick={() => begin(contest)}>{copy('Resolve this tie', 'ამ ფრეს გადაწყვეტა')}</button>
                            : <p className="ttr-readonly"><LockKeyhole size={14}/>{copy('Only tournament ADMIN or STAFF can record this decision. You can still see exactly why progression is blocked.', 'ამ გადაწყვეტილების ჩაწერა მხოლოდ ტურნირის ADMIN-ს ან STAFF-ს შეუძლია. დაბლოკვის მიზეზი მაინც სრულად ჩანს.')}</p>
                    ) : <p className="ttr-readonly"><History size={14}/>{copy('The source results are not final yet. Resolution becomes available when the server marks this tied set ready.', 'საწყისი შედეგები ჯერ საბოლოო არ არის. გადაწყვეტილება ხელმისაწვდომი გახდება, როცა სერვერი ამ ფრეს მზადად მონიშნავს.')}</p> : null}
                </article>;
            })}
        </div>
        {canAudit && history.length ? <div className="ttr-audit"><h3><History size={15}/>{copy('Decision audit', 'გადაწყვეტილებების ისტორია')}</h3>{[...history].reverse().map(decision => {
            const invalidated = decision.invalidatedAt != null;
            const operator = tournament.staffAssignments.find(item => item.userId === decision.operatorId)?.fullName ?? `${copy('Operator', 'ოპერატორი')} #${decision.operatorId}`;
            return <article className={invalidated ? 'is-invalidated' : ''} key={decision.id}>
                <div><strong>{entryLabel(tournament, decision.selectedEntryId)}</strong><span>{invalidated ? copy('Invalidated / superseded', 'გაუქმებული / ჩანაცვლებული') : copy('Current decision', 'მიმდინარე გადაწყვეტილება')}</span></div>
                <p>“{decision.note}”</p>
                <dl><div><dt>{copy('Operator', 'ოპერატორი')}</dt><dd>{operator}</dd></div><div><dt>{copy('Decided', 'გადაწყდა')}</dt><dd>{new Date(decision.decidedAt).toLocaleString(ka ? 'ka-GE' : 'en-GB')}</dd></div><div><dt>{copy('Source revision', 'წყაროს ვერსია')}</dt><dd><code>{decision.sourceRevision}</code></dd></div></dl>
                {invalidated ? <p className="ttr-invalidation"><AlertTriangle size={13}/>{decision.invalidationReason ? (invalidationCopy[decision.invalidationReason] ?? decision.invalidationReason) : copy('The underlying Competition state changed.', 'შეჯიბრების საფუძვლად არსებული მდგომარეობა შეიცვალა.')}{decision.invalidatedAt ? ` ${new Date(decision.invalidatedAt).toLocaleString(ka ? 'ka-GE' : 'en-GB')}` : ''}</p> : null}
                <details className="ttr-rules"><summary>{copy('Recorded rule context', 'ჩაწერილი წესების კონტექსტი')}</summary><p>{decision.ruleContext}</p><code>{copy('Submitted revision', 'გაგზავნილი ვერსია')}: {decision.submittedRevision}</code></details>
            </article>;
        })}</div> : null}

        {draft ? <div className="ttr-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) setDraft(null); }}>
            <div className="ttr-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tie-dialog-title">
                <header><div><p>{copy('Audited sporting decision', 'აუდიტირებული სპორტული გადაწყვეტილება')}</p><h2 id="tie-dialog-title">{draft.review ? copy('Confirm the consequence', 'შედეგის დადასტურება') : contestLocation(draft.contest, tournament)}</h2></div><button type="button" disabled={submitting} aria-label={copy('Close tie resolution', 'ფრეს გადაწყვეტის დახურვა')} onClick={() => setDraft(null)}><X/></button></header>
                {draft.error ? <p className={`ttr-dialog-error ${draft.stale ? 'is-stale' : ''}`} role="alert">{draft.error}</p> : null}
                {draft.stale ? <button type="button" className="ttr-secondary" disabled={refreshing || submitting} onClick={returnToCurrentDraft}>{!state || loadError ? copy('Retry tie status', 'ფრეს სტატუსის ხელახლა ჩატვირთვა') : copy('Return to the saved draft', 'შენახულ მონახაზზე დაბრუნება')}</button> : null}
                {!draft.review ? <div className="ttr-form">
                    <fieldset><legend>{copy('Choose from the tied contenders', 'აირჩიეთ თანაბარი მონაწილეებიდან')}</legend>{draft.contest.candidateEntryIds.map(id => <label key={id}><input type="radio" name="tie-contender" checked={draft.selectedEntryId === id} onChange={() => setDraft({ ...draft, selectedEntryId: id, error: '' })}/><span><strong>{entryLabel(tournament, id)}</strong><small>{copy('Server candidate', 'სერვერის კანდიდატი')} #{id}</small></span></label>)}</fieldset>
                    <label className="ttr-note"><span>{copy('Required reason or note', 'სავალდებულო მიზეზი ან შენიშვნა')}</span><textarea aria-label={copy('Required reason or note', 'სავალდებულო მიზეზი ან შენიშვნა')} maxLength={2000} rows={5} value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value, error: '' })} placeholder={copy('Document the competition-rule decision…', 'აღწერეთ შეჯიბრების წესზე დაფუძნებული გადაწყვეტილება…')}/><small>{draft.note.length}/2000</small></label>
                    <details className="ttr-rules" open><summary>{copy('Rules already applied', 'უკვე გამოყენებული წესები')}</summary><p>{draft.contest.ruleContext}</p></details>
                    <div className="ttr-dialog-actions"><button type="button" className="ttr-secondary" onClick={() => setDraft(null)}>{copy('Cancel', 'გაუქმება')}</button><button type="button" className="ttr-primary" disabled={draft.stale || !canResolve || draft.selectedEntryId == null || !draft.note.trim()} onClick={review}>{copy('Preview consequence', 'შედეგის გადახედვა')}</button></div>
                </div> : <div className="ttr-preview">
                    <div><span>{copy('Selected contender', 'არჩეული მონაწილე')}</span><strong>{draft.selectedEntryId == null ? '—' : entryLabel(tournament, draft.selectedEntryId)}</strong></div>
                    <div><span>{copy('Decision reason', 'გადაწყვეტილების მიზეზი')}</span><p>{draft.note}</p></div>
                    <div className="is-consequence"><span>{copy('Immediate consequence', 'დაუყოვნებელი შედეგი')}</span><strong>{consequence(draft.contest)}</strong><p>{copy('The server will record this audit decision and immediately retry the affected advancement. Competition completion remains separate.', 'სერვერი ჩაწერს აუდიტირებულ გადაწყვეტილებას და დაუყოვნებლივ ხელახლა სცდის შესაბამის წინსვლას. შეჯიბრების დასრულება ცალკე მოქმედებად რჩება.')}</p></div>
                    <code>{copy('Expected source revision', 'მოსალოდნელი წყაროს ვერსია')}: {draft.contest.sourceRevision}</code>
                    <div className="ttr-dialog-actions"><button type="button" className="ttr-secondary" disabled={submitting} onClick={() => setDraft({ ...draft, review: false })}>{copy('Back', 'უკან')}</button><button type="button" className="ttr-primary" disabled={submitting || draft.stale || !canResolve} onClick={() => void confirm()}>{submitting ? <><Loader2 className="animate-spin"/>{copy('Recording…', 'იწერება…')}</> : copy('Confirm decision', 'გადაწყვეტილების დადასტურება')}</button></div>
                </div>}
            </div>
        </div> : null}
    </section>;
}
