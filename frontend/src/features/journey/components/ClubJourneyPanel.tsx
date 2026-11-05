import { RecruitmentInbox } from '../../recruitment/RecruitmentApplication';
import { formatDate } from '../../../utils/formatting';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CalendarDays, Loader2, Mail, ShieldAlert, Users } from 'lucide-react';
import { fetchClubJourney } from '../../clubs/api';
import type { ClubJourney } from '../../clubs/domain';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { recruitmentStatusKey, useRecruitmentCopy } from '../../../locales/recruitmentDesign';
import '../../../components/squads/squad-design.css';
import '../../../components/workspace/recruitment/recruitment-design.css';
import { useAuth } from '../../../context/AuthContext';
import { OrganizationInvitationInbox } from '../../organizations/setup/OrganizationInvitationInbox';
import { ClubRelationships } from './ClubRelationships';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/** The player's applications and club affiliations; an invitation is answered in the Inbox. */
const ClubJourneyContent = () => {
    const { sessionId } = useAuth();
    const { t } = useTranslation();
    const copy = useJourneyCopy();
    const r = useRecruitmentCopy();
    const navigate = useNavigate();
    const [journey, setJourney] = useState<ClubJourney | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const mounted = useRef(false);
    const latestLoad = useRef(0);

    const load = useCallback(async (signal?: AbortSignal) => {
        const sequence = ++latestLoad.current;
        const current = () => mounted.current && !signal?.aborted && sequence === latestLoad.current && isCurrentAuthSession(sessionId);
        try {
            const result = await fetchClubJourney({ _authSessionId: sessionId, signal });
            if (current()) { setJourney(result); setLoadError(null); }
        } catch (err) { if (current()) setLoadError(extractApiErrorMessage(err, 'Failed to load your club journey.')); }
        finally { if (current()) setLoading(false); }
    }, [sessionId]);
    useEffect(() => {
        mounted.current = true;
        const controller = new AbortController();
        const refresh = () => { void load(controller.signal); };
        refresh();
        const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
        window.addEventListener('requests-updated', refresh);
        window.addEventListener('focus', refresh);
        window.addEventListener('online', refresh);
        return () => { mounted.current = false; controller.abort(); window.clearInterval(timer); window.removeEventListener('requests-updated', refresh); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
    }, [load]);

    const statusLabel = (status: string) => {
        if (status === 'ACTIVE') return t('journey.member');
        if (status === 'TRIALIST') return t('journey.onTrial');
        const key = recruitmentStatusKey(status);
        return key ? r(key) : status.replaceAll('_', ' ');
    };

    if (loading) return <div className="flex items-center justify-center py-8" role="status"><Loader2 className="h-6 w-6 animate-spin text-[var(--fc-accent)]" /></div>;
    if (loadError && !journey) return <div className="squad-design recruitment-design sd-empty" role="alert"><p>{loadError}</p><button type="button" className="sd-button" onClick={() => void load()}>{t('journey.retry')}</button></div>;
    if (!journey) return null;

    const pills = [
        { label: t('journey.pillApplied'), count: journey.applications.filter((app) => app.status === 'PENDING').length },
        { label: t('journey.pillInvited'), count: journey.invitations.length },
        { label: t('journey.pillOnTrial'), count: journey.affiliations.filter((aff) => aff.status === 'TRIALIST').length },
        { label: t('journey.pillMember'), count: journey.affiliations.filter((aff) => aff.status === 'ACTIVE').length },
        { label: t('journey.pillNotAccepted'), count: journey.recentDecisions.filter((decision) => decision.status === 'DECLINED' || decision.status === 'REJECTED').length },
    ];
    const hasActivity = journey.applications.length > 0 || journey.invitations.length > 0 || journey.tryouts.length > 0 || journey.affiliations.length > 0 || journey.recentDecisions.length > 0;
    const viewClub = (clubId: number) => <button type="button" className="rc-link" onClick={() => navigate(`/clubs/${clubId}`)}>{r('viewClub')}<ArrowUpRight size={13} /></button>;

    return <div className="squad-design recruitment-design rc-journey">
        <header className="sd-heading"><div><span className="sd-eyebrow">{r('recruitment')}</span><h2>{r('journey')}</h2><p>{r('journeyIntro')}</p></div></header>
        {loadError && <p role="alert" className="text-xs text-[var(--fc-state-danger)]">{loadError} <button type="button" className="sd-button" onClick={() => void load()}>{t('journey.retry')}</button></p>}
        <div className="rc-journey-counts">{pills.map((pill) => <span key={pill.label}>{pill.label} · {pill.count}</span>)}</div>
        {!hasActivity && <div className="sd-empty"><Users size={28} /><p>{t('journey.empty')}</p><button type="button" className="sd-button" onClick={() => navigate('/map')}>{t('journey.browseClubs')}<ArrowUpRight size={14} /></button></div>}

        {journey.invitations.length > 0 && <section className="rc-journey-section"><h3>{t('journey.invitations')}</h3><Link className="rc-link" to="/requests?view=needs-you">{copy('Answer in your Inbox', 'უპასუხეთ შემოსულებში')}<ArrowUpRight size={13} /></Link></section>}

        {journey.affiliations.length > 0 && <section className="rc-journey-section"><h3>{r('yourClubs')}</h3>{journey.affiliations.map((affiliation) => <article key={`${affiliation.clubId}-${affiliation.status}`} className="sd-panel rc-journey-card">
            <div className="rc-journey-card-row"><div className="rc-journey-card-main"><h4>{affiliation.clubName}</h4><p>{[affiliation.squadName, affiliation.trialEndsOn ? `${t('journey.trialEnds')} ${formatDate(affiliation.trialEndsOn)}` : null].filter(Boolean).join(' · ')}</p></div><span className="rc-status" data-status={affiliation.status}>{statusLabel(affiliation.status)}</span></div>
            {(affiliation.status === 'TRIALIST' || affiliation.status === 'ACTIVE') && <p>{r(affiliation.status === 'TRIALIST' ? 'trialHint' : 'activeHint')}</p>}
            {affiliation.consentStatus === 'PENDING' && <div className="rc-summary"><span className="rc-consent"><ShieldAlert size={13} />{r('consentPending')}</span></div>}
            {viewClub(affiliation.clubId)}
        </article>)}</section>}



        {journey.tryouts.length > 0 && <section className="rc-journey-section"><h3>{t('journey.tryouts')}</h3>{journey.tryouts.map((tryout) => <article key={tryout.tryoutApplicationId} className="sd-panel rc-journey-card">
            <div className="rc-journey-card-row"><CalendarDays size={18} className="sd-muted" /><div className="rc-journey-card-main"><h4>{tryout.title} · {tryout.clubName}</h4>{tryout.tryoutDate && <p>{formatDate(tryout.tryoutDate)}</p>}</div><span className="rc-status" data-status={tryout.status}>{statusLabel(tryout.status)}</span></div>{tryout.status === 'ACCEPTED' && <p>{r('acceptedTryoutHint')}</p>}{tryout.decisionMessage && <p className="rc-message">{tryout.decisionMessage}</p>}{viewClub(tryout.clubId)}
        </article>)}</section>}

        {journey.recentDecisions.length > 0 && <section className="rc-journey-section"><h3>{t('journey.recentDecisions')}</h3>{journey.recentDecisions.slice(0, 5).map((decision, index) => <article key={`${decision.kind}-${decision.clubName}-${index}`} className="sd-panel rc-journey-card"><div className="rc-journey-card-row"><Mail size={16} className="sd-muted" /><div className="rc-journey-card-main"><h4>{decision.clubName} · {statusLabel(decision.status)}</h4>{decision.decidedAt && <p>{formatDate(decision.decidedAt)}</p>}</div></div>{decision.message && <p>{decision.message}</p>}</article>)}</section>}
    </div>;
};

export const ClubJourneyPanel = () => {
    const { sessionId } = useAuth();
    const [revision, setRevision] = useState(0);
    return <><OrganizationInvitationInbox key={`${sessionId}:invitations`} /><ClubRelationships key={`${sessionId}:relationships`} onChanged={() => setRevision(value => value + 1)} /><RecruitmentInbox key={`${sessionId}:recruitment`} onChanged={() => setRevision(value => value + 1)} /><ClubJourneyContent key={`${sessionId}:${revision}`} /></>;
};
