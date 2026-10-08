import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3, Inbox, MapPin, Send, Shield, ShieldCheck, Trophy, UserCheck, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../../../features/clubs/domain';
import type { ScheduleEventOccurrence, ScheduleEventType } from '../../../features/schedule/api';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { formatDate, formatTime } from '../../../utils/formatting';
import type { WorkspaceTab } from '../types';
import { useOverviewConsent } from './useOverviewConsent';
import '../../squads/squad-design.css';
import './club-overview.css';

interface OverviewTabProps {
    overview: ClubManagementOverview | null;
    clubId: number;
    onTabChange: (tab: WorkspaceTab) => void;
    overdueTrialistCount?: number;
    canManageLeadership: boolean;
    canManageOperations: boolean;
    upcomingEvents: ScheduleEventOccurrence[];
    scheduleLoading: boolean;
    scheduleError: string | null;
    tryoutPendingCount: number;
    unreadInboxCount: number;
    onOpenSchedule: () => void;
    onOpenScheduleEvent?: (event: ScheduleEventOccurrence) => void;
    onRetrySchedule: () => void;
    onOpenPlayers?: (status: 'ALL' | PlayerAffiliationStatus) => void;
    beforeContent?: ReactNode;
    description?: string;
    statsContent?: ReactNode;
    staffCount?: number;
    onOpenStaff?: () => void;
    scheduleContent?: ReactNode;
    attentionContent?: ReactNode;
    quickActionsContent?: ReactNode;
}

const eventLabels: Record<ScheduleEventType, keyof typeof clubOverviewEn> = {
    TRAINING: 'training', TRYOUT: 'tryout', MATCH: 'match', FRIENDLY: 'friendly', ACTIVITY: 'activity',
};

export const OverviewTab = ({
    overview, clubId, onTabChange, overdueTrialistCount, canManageLeadership, canManageOperations,
    upcomingEvents, scheduleLoading, scheduleError, tryoutPendingCount, unreadInboxCount,
    onOpenSchedule, onOpenScheduleEvent, onRetrySchedule, onOpenPlayers,
    beforeContent, description, statsContent, staffCount, onOpenStaff, scheduleContent, attentionContent, quickActionsContent,
}: OverviewTabProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const copy = (key: keyof typeof clubOverviewEn, values?: Record<string, string | number>) =>
        t(`clubOverview.${key}`, { defaultValue: clubOverviewEn[key], ...values });
    const pendingApplications = overview?.pendingApplications.length ?? 0;
    const pendingInvitations = overview?.pendingInvitations.length ?? 0;
    const tryoutReviews = overview?.pendingTryoutCount ?? tryoutPendingCount;
    const totalTrialists = overview?.trialistCount ?? 0;
    const overdue = overview?.overdueTrialistCount ?? overdueTrialistCount ?? 0;
    const consent = useOverviewConsent(clubId, canManageOperations && overview !== null, overview?.activePlayerCount ?? 0, totalTrialists);
    const consentComplete = consent.result !== null && consent.result.reviewed >= consent.result.total;
    const openPlayers = (status: 'ALL' | PlayerAffiliationStatus = 'ALL') => {
        if (onOpenPlayers) onOpenPlayers(status);
        else onTabChange('players');
    };
    const now = new Date();
    const events = upcomingEvents.slice(0, 4);
    const reviews = canManageOperations ? [
        { key: 'overdueTrials', hint: 'overdueHint', count: overdue, icon: Clock3, tone: 'danger', action: () => openPlayers('TRIALIST') },
        { key: 'applications', hint: 'applicationsHint', count: pendingApplications, icon: ClipboardList, tone: 'warning', action: () => onTabChange('applications') },
        { key: 'tryoutReviews', hint: 'tryoutHint', count: tryoutReviews, icon: CheckCircle2, tone: 'neutral', action: () => onTabChange('tryouts') },
        { key: 'trialReviews', hint: 'trialHint', count: Math.max(0, totalTrialists - overdue), icon: UserPlus, tone: 'neutral', action: () => openPlayers('TRIALIST') },
    ].filter((item) => item.count > 0) : [];

    return (
        <div className="squad-design club-overview">
            <header className="sd-heading club-overview-heading">
                <div>
                    <span className="sd-eyebrow">{copy('eyebrow')}</span>
                    <h1>{copy('title')}</h1>
                    <p>{description ?? copy('description')}</p>
                </div>
                <div className="club-overview-heading-actions">
                    <span className="club-overview-today">{formatDate(now, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <button type="button" className="sd-primary" onClick={onOpenSchedule}>
                        <CalendarDays size={16} aria-hidden="true" />{copy('openCalendar')}
                    </button>
                </div>
            </header>

            {beforeContent}
            {statsContent ?? <div className="club-overview-stats" role="group" aria-label={copy('title')}>
                {[
                    { label: 'activePlayers', count: overview?.activePlayerCount ?? 0, icon: UserCheck, action: canManageOperations ? () => openPlayers('ACTIVE') : undefined },
                    { label: 'trialists', count: totalTrialists, icon: UserPlus, action: canManageOperations ? () => openPlayers('TRIALIST') : undefined },
                    { label: 'staff', count: staffCount ?? overview?.members.length ?? 0, icon: Users, action: canManageLeadership ? onOpenStaff ?? (() => onTabChange('personnel')) : undefined },
                    { label: 'inbox', count: unreadInboxCount, icon: Inbox, action: () => onTabChange('inbox') },
                ].map(({ label, count, icon: Icon, action }) => {
                    const content = <><span><Icon size={15} aria-hidden="true" />{copy(label as keyof typeof clubOverviewEn)}</span><strong>{count}</strong></>;
                    return action
                        ? <button type="button" className="club-overview-stat" data-stat={label} key={label} onClick={action}>{content}<ChevronRight size={14} aria-hidden="true" /></button>
                        : <div className="club-overview-stat" data-stat={label} key={label}>{content}</div>;
                })}
            </div>}

            <div className="club-overview-main-grid">
                <div className="club-overview-primary">
                {scheduleContent ?? <section className="sd-panel club-overview-schedule" aria-labelledby="overview-schedule-title" aria-busy={scheduleLoading}>
                    <div className="club-overview-panel-heading">
                        <div><span className="sd-eyebrow">{copy('nextSevenDays')}</span><h2 id="overview-schedule-title">{copy('upcoming')}</h2><p>{copy('scheduleHint')}</p></div>
                        <CalendarDays size={20} className="club-overview-panel-icon" aria-hidden="true" />
                    </div>
                    {scheduleLoading ? <p className="club-overview-state" role="status">{copy('scheduleLoading')}</p>
                        : scheduleError ? <div className="club-overview-state" role="status"><p>{copy('scheduleError')}</p><button type="button" className="sd-button" onClick={onRetrySchedule}>{copy('retry')}</button></div>
                            : events.length === 0 ? <div className="club-overview-state club-overview-empty"><CalendarDays size={28} aria-hidden="true" /><p>{copy('scheduleEmpty')}</p></div>
                                : <div className="club-overview-events">{events.map((event, index) => {
                                    const start = new Date(event.startsAt);
                                    const isToday = start.toDateString() === now.toDateString();
                                    const inProgress = start <= now && new Date(event.endsAt) > now;
                                    return <button key={`${event.eventId}-${event.occurrenceId}`} type="button" className={`club-overview-event${index === 0 ? ' club-overview-event-first' : ''}`} onClick={() => onOpenScheduleEvent ? onOpenScheduleEvent(event) : onOpenSchedule()} aria-label={copy('openEvent', { name: event.title })}>
                                        <span className="club-overview-event-date"><strong>{formatDate(event.startsAt, { day: '2-digit' })}</strong><span>{isToday ? copy('today') : formatDate(event.startsAt, { weekday: 'short' })}</span></span>
                                        <span className="club-overview-event-info">
                                            <span className="club-overview-event-meta"><span data-type={event.eventType}>{copy(eventLabels[event.eventType] ?? 'activity')}</span>{(index === 0 || inProgress) && <span className="club-overview-next">{copy(inProgress ? 'inProgress' : 'nextUp')}</span>}</span>
                                            <strong>{event.title}</strong>
                                            <span className="club-overview-event-detail"><Clock3 size={12} aria-hidden="true" />{formatTime(event.startsAt)} – {formatTime(event.endsAt)}<span className="club-overview-event-month">· {formatDate(event.startsAt, { month: 'short' })}</span></span>
                                            <span className="club-overview-event-detail"><MapPin size={12} aria-hidden="true" />{event.locationName || copy('locationMissing')}</span>
                                            {event.conflict && <span className="club-overview-conflict">{copy('scheduleConflict')}</span>}
                                        </span>
                                        <ArrowRight size={17} className="club-overview-row-arrow" aria-hidden="true" />
                                    </button>;
                                })}</div>}
                    {!scheduleLoading && !scheduleError && events.length > 0 && <button type="button" className="club-overview-panel-link" onClick={onOpenSchedule}>{copy('seeFullWeek')}<ArrowRight size={14} aria-hidden="true" /></button>}
                </section>}

                {quickActionsContent}
                </div>
                <div className="club-overview-side">
                    {attentionContent}
                    {canManageOperations && <section className="sd-panel club-overview-reviews" aria-labelledby="overview-reviews-title">
                        <div className="club-overview-panel-heading"><div><h2 id="overview-reviews-title">{copy('decisions')}</h2><p>{copy('decisionsHint')}</p></div></div>
                        {reviews.length > 0 ? <div className="club-overview-review-list">{reviews.map(({ key, hint, count, icon: Icon, tone, action }) => <button type="button" className="club-overview-review" key={key} data-tone={tone} onClick={action}>
                            <span className="club-overview-review-icon"><Icon size={17} aria-hidden="true" /></span>
                            <span className="club-overview-review-copy"><strong>{copy(key as keyof typeof clubOverviewEn)}</strong><span>{copy(hint as keyof typeof clubOverviewEn)}</span></span>
                            <span className="club-overview-review-count">{count}</span><ChevronRight size={14} className="club-overview-row-arrow" aria-hidden="true" />
                        </button>)}</div> : <div className="club-overview-state club-overview-clear"><Check size={22} aria-hidden="true" /><strong>{copy('decisionsClear')}</strong><p>{copy('decisionsClearHint')}</p></div>}
                    </section>}

                    {canManageOperations && <section className="sd-panel club-overview-consent" aria-labelledby="overview-consent-title" aria-busy={consent.loading}>
                        <div className="club-overview-panel-heading"><div><h2 id="overview-consent-title"><ShieldCheck size={17} aria-hidden="true" />{copy('parentConsent')}</h2><p>{copy('consentHint')}</p></div></div>
                        {consent.loading ? <p className="club-overview-state" role="status">{copy('consentLoading')}</p>
                            : consent.error ? <div className="club-overview-state" role="status"><p>{copy('consentError')}</p><button type="button" className="sd-button" onClick={() => { void consent.retry(); }}>{copy('retry')}</button></div>
                                : consent.result && <>
                                    {consent.result.players.length > 0 ? <div className="club-overview-consent-list">
                                        <p className="club-overview-consent-summary">{copy(consentComplete ? 'consentSummary' : 'consentSampleSummary', { count: consent.result.players.length })}</p>
                                        {consent.result.players.slice(0, 3).map((player) => {
                                            const name = player.fullName || player.username || copy('playerFallback', { id: player.userId });
                                            const status = player.parentalConsentStatus;
                                            const statusLabel = status === 'PENDING' ? 'consentPending' : status === 'EXPIRED' ? 'consentExpired' : status === 'DECLINED' ? 'consentDeclined' : 'consentMissing';
                                            return <button type="button" className="club-overview-consent-player" key={player.userId} onClick={() => openPlayers(player.status)}>
                                                <span className="club-overview-avatar" aria-hidden="true">{name.charAt(0).toLocaleUpperCase()}</span><span><strong>{name}</strong><small data-status={status || 'MISSING'}>{copy(statusLabel)}</small></span><ChevronRight size={14} aria-hidden="true" />
                                            </button>;
                                        })}
                                    </div> : <p className="club-overview-state club-overview-consent-clear"><Check size={17} aria-hidden="true" />{copy('consentClear')}</p>}
                                    <p className="club-overview-coverage">{consentComplete ? copy('consentComplete') : copy('consentPartial', { reviewed: consent.result.reviewed, total: consent.result.total })}</p>
                                </>}
                        <button type="button" className="club-overview-panel-link" onClick={() => openPlayers()}>{copy('openPlayers')}<ArrowRight size={14} aria-hidden="true" /></button>
                    </section>}
                </div>
            </div>

            {!quickActionsContent && <section className="club-overview-essentials" aria-labelledby="overview-essentials-title">
                <h2 id="overview-essentials-title">{copy('quickActions')}</h2>
                <div>
                    {[
                        ...(canManageOperations ? [
                            { key: 'squads', hint: copy('squadsHint'), icon: Shield, action: () => onTabChange('squads') },
                            { key: 'invites', hint: pendingInvitations > 0 ? copy('invitesHint', { count: pendingInvitations }) : copy('inviteNewHint'), icon: Send, action: () => onTabChange('invites') },
                        ] : []),
                        ...(canManageLeadership ? [{ key: 'staff', hint: copy('staffHint'), icon: Users, action: () => onTabChange('personnel') }] : []),
                        { key: 'inbox', hint: copy('inboxHint', { count: unreadInboxCount }), icon: Inbox, action: () => onTabChange('inbox') },
                        { key: 'tournament', hint: copy('tournamentHint'), icon: Trophy, action: () => navigate('/tournaments/setup') },
                    ].map(({ key, hint, icon: Icon, action }) => <button type="button" className="club-overview-essential" key={key} onClick={action}><Icon size={17} aria-hidden="true" /><span><strong>{copy(key as keyof typeof clubOverviewEn)}</strong><small>{hint}</small></span><ArrowRight size={14} aria-hidden="true" /></button>)}
                </div>
            </section>}
        </div>
    );
};
