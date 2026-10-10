import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MessageSquare, Send, X } from 'lucide-react';
import { Avatar, Badge, Button, Field, type BadgeTone } from '../../../design/primitives';
import { squadLabel } from '../../../components/squads/squadLabels';
import type { ClubPlayerAffiliation, PlayerAffiliationStatus } from '../../clubs/domain';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formatDate } from '../../../utils/formatting';

export interface PlayerRowActions {
    pendingKey: string | null;
    canManagePlayerStatuses: boolean;
    onPlayerStatusChange: (userId: number, status: PlayerAffiliationStatus, playerName?: string) => Promise<void>;
    onTrialEndsChange: (userId: number, trialEndsOn: string) => Promise<void>;
    onReviewJoining?: (userId: number) => void;
    onOpenAdmissions: () => void;
    onMessagePlayer?: (userId: number, playerName?: string) => void;
    onSendConsentEmail?: (userId: number, parentEmail?: string | null) => Promise<boolean> | void;
}

const TRIAL_LIMIT_DAYS = 14;
const statusTone: Record<string, BadgeTone> = { ACTIVE: 'accent', TRIALIST: 'warning', PAST: 'neutral', REMOVED: 'neutral' };
const shortDate = (value?: string | null) => value ? formatDate(value, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/**
 * One club player: who they are, their status and consent, and the next action. Trial dates, consent
 * and status changes sit in the row's own disclosure. Taking a player out of the club or its squads is
 * confirmed (with a note) by the workspace before anything changes. A player whose joining is handled by
 * an admission arrangement is changed there, not here.
 */
export function PlayerRow({ player, actions, admissionManaged, now }: { player: ClubPlayerAffiliation; actions: PlayerRowActions; admissionManaged: boolean; now: number }) {
    const { t } = useTranslation();
    const [emailOpen, setEmailOpen] = useState(false), [email, setEmail] = useState('');
    const name = player.fullName || player.username || `Player #${player.userId}`;
    const { pendingKey, canManagePlayerStatuses: canManage } = actions;
    const trialist = player.status === 'TRIALIST', current = player.status === 'ACTIVE' || trialist;
    const days = trialist && player.joinedAt ? Math.max(0, Math.floor((now - new Date(player.joinedAt).getTime()) / 86_400_000)) : null;
    const consent = player.parentalConsentStatus;
    const consentToSend = current && Boolean(player.requiresParentalConsent) && (!consent || consent === 'NOT_REQUIRED') && Boolean(actions.onSendConsentEmail);
    const canResend = Boolean(player.parentEmail && current && actions.onSendConsentEmail) && (consent === 'PENDING' || consent === 'EXPIRED' || consent === 'DECLINED');
    const sending = pendingKey === `consent-${player.userId}`;
    const statusLabel = t(`squadDesign.players.status.${player.status}`, { defaultValue: player.status });
    const copy = (key: string, fallback: string, values?: Record<string, unknown>) => t(`squadDesign.players.${key}`, { defaultValue: fallback, ...values });

    const consentBadge = consent === 'CONFIRMED' ? <Badge tone="accent">{copy('consentConfirmed', 'Consent confirmed')}</Badge>
        : consent === 'DECLINED' ? <Badge tone="danger">{t('minors.playersTab.consentDeclined')}</Badge>
            : consent === 'EXPIRED' ? <Badge tone="danger">{t('minors.playersTab.consentExpired')}</Badge>
                : consent === 'PENDING' ? <Badge tone="info">{t('minors.playersTab.consentPending')}</Badge>
                    : consentToSend ? <Badge tone="warning">{copy('consentNeeded', 'Consent needed')}</Badge> : null;
    const send = async () => {
        const sent = await actions.onSendConsentEmail?.(player.userId, email.trim());
        if (sent !== false) { setEmailOpen(false); setEmail(''); }
    };
    const changes: Array<{ status: PlayerAffiliationStatus; label: string }> = player.status === 'ACTIVE' && canManage && !admissionManaged ? [
        { status: 'TRIALIST', label: copy('demote', 'Move back to trial') },
        { status: 'PAST', label: copy('markPast', 'Mark as past player') },
        { status: 'REMOVED', label: copy('remove', 'Remove from club') },
    ] : [];
    const hasDetails = trialist || (!admissionManaged && (consentToSend || canResend)) || changes.length > 0;
    const facts = [player.position ? squadLabel(player.position, t) : null, player.jerseyNumber != null ? `#${player.jerseyNumber}` : null,
        player.joinedAt ? copy('joinedOn', 'Joined {{date}}', { date: shortDate(player.joinedAt) }) : null].filter(Boolean).join(' · ') || `@${player.username}`;

    return <li className="pl-row" data-status={player.status}>
        <div className="gk-list-row pl-row__line">
            <Avatar src={resolveMediaUrl(player.avatarUrl) || null} name={name} size={40} />
            <span className="gk-list-row__main">
                <Link className="pl-name" to={`/profile/${player.userId}`}>{name}</Link>
                <span className="gk-list-row__meta">{facts}</span>
            </span>
            <span className="pl-row__badges">
                <Badge tone={trialist && days !== null && days > TRIAL_LIMIT_DAYS ? 'danger' : statusTone[player.status] ?? 'neutral'}>{trialist && days !== null ? copy('trialDay', '{{status}} · day {{count}}', { status: statusLabel, count: days }) : statusLabel}</Badge>
                {consentBadge}
            </span>
            <span className="pl-row__actions">
                {admissionManaged && actions.onReviewJoining
                    ? <Button size="sm" onClick={() => actions.onReviewJoining!(player.userId)}>{trialist ? copy('viewTerms', 'View agreed terms') : copy('reviewPlacement', 'Review placement')}</Button>
                    : trialist ? <>
                        {(actions.onReviewJoining || canManage) && <Button size="sm" onClick={() => actions.onReviewJoining ? actions.onReviewJoining(player.userId) : actions.onOpenAdmissions()}>{copy('reviewJoining', 'Review joining')}</Button>}
                        {canManage ? <Button size="sm" variant="danger" disabled={pendingKey === `player-${player.userId}-REMOVED`} onClick={() => void actions.onPlayerStatusChange(player.userId, 'REMOVED', player.fullName || undefined)}><X aria-hidden="true" />{t('trialists.release')}</Button>
                            : !actions.onReviewJoining && <span className="pl-quiet" title={copy('reviewOnlyHint', 'Only club owners and admins can finalise player status.')}>{copy('reviewOnly', 'Review only')}</span>}
                    </> : null}
                {player.status === 'ACTIVE' && actions.onMessagePlayer && <Button size="sm" variant="ghost" iconOnly aria-label={copy('message', 'Message {{name}}', { name })} title={copy('message', 'Message {{name}}', { name })} onClick={() => actions.onMessagePlayer!(player.userId, player.fullName || undefined)}><MessageSquare aria-hidden="true" /></Button>}
            </span>
        </div>
        {hasDetails && <details className="pl-details" open={emailOpen || undefined}>
            <summary>{trialist ? copy('trialAndConsent', 'Trial and consent') : consentToSend || canResend ? copy('consentAndStatus', 'Consent and status') : copy('statusSection', 'Status')}
                {trialist && player.trialEndsOn && <span className="pl-quiet"> · {copy('trialEndsOn', 'Trial ends {{date}}', { date: shortDate(player.trialEndsOn) })}</span>}</summary>
            <div className="pl-details__body">
                {trialist && <Field label={t('trialists.trialEnds')} htmlFor={`pl-trial-${player.userId}`} hint={admissionManaged ? copy('trialFromArrangement', 'Set in the player’s joining arrangement.') : canManage ? undefined : copy('trialLeadership', 'Only club owners and admins can change trial dates.')}>
                    <input id={`pl-trial-${player.userId}`} className="gk-input pl-date" type="date" value={player.trialEndsOn ?? ''} aria-label={`${t('trialists.trialEnds')} ${name}`}
                        disabled={!canManage || admissionManaged || pendingKey === `trial-ends-${player.userId}`} onChange={event => void actions.onTrialEndsChange(player.userId, event.target.value)} />
                </Field>}
                {!admissionManaged && (consentToSend || canResend) && <div className="pl-consent">
                    <span className="gk-field__label">{copy('parentConsent', 'Parent consent')}</span>
                    {canResend ? <Button size="sm" disabled={sending} title={t('minors.playersTab.resendTo', { email: player.parentEmail })} onClick={() => void actions.onSendConsentEmail?.(player.userId, player.parentEmail)}><Send aria-hidden="true" />{t('minors.playersTab.resend')}</Button>
                        : emailOpen ? <form className="gk-row pl-consent__form" onSubmit={event => { event.preventDefault(); void send(); }}>
                            <input className="gk-input" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={t('minors.playersTab.parentEmailPlaceholder')} aria-label={`${t('minors.playersTab.parentEmailPlaceholder')} ${name}`} autoFocus />
                            <Button type="submit" size="sm" variant="primary" disabled={!email.trim() || sending}>{t('minors.playersTab.send')}</Button>
                            <Button size="sm" variant="ghost" iconOnly aria-label={t('minors.playersTab.cancelEmail')} onClick={() => setEmailOpen(false)}><X aria-hidden="true" /></Button>
                        </form>
                            : <Button size="sm" disabled={sending} onClick={() => { if (player.parentEmail) void actions.onSendConsentEmail?.(player.userId, player.parentEmail); else { setEmail(''); setEmailOpen(true); } }}><Send aria-hidden="true" />{t('minors.playersTab.sendConsent')}</Button>}
                </div>}
                {changes.length > 0 && <div className="gk-row pl-status-actions">{changes.map(change => <Button key={change.status} size="sm" variant={change.status === 'TRIALIST' ? 'secondary' : 'danger'}
                    disabled={pendingKey === `player-${player.userId}-${change.status}`} onClick={() => void actions.onPlayerStatusChange(player.userId, change.status, player.fullName || undefined)}>{change.label}</Button>)}</div>}
            </div>
        </details>}
    </li>;
}
