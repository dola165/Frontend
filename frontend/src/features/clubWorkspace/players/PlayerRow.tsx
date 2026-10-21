import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, X } from 'lucide-react';
import { Button, Field, type BadgeTone } from '../../../design/primitives';
import { EMPTY_CELL, Status } from '../../../design/DataTable';
import type { ClubPlayerAffiliation } from '../../clubs/domain';
import { playerChoices, playerName, trialDay, type PlayerRowActions } from './playerChoices';

const TRIAL_LIMIT_DAYS = 14;
const statusTone: Record<string, BadgeTone> = { ACTIVE: 'accent', TRIALIST: 'warning', PAST: 'neutral', REMOVED: 'neutral' };

/** Status in words with its dot; a trial shows its day, in red once it runs past the usual two weeks. */
export function PlayerStatus({ player, now }: { player: ClubPlayerAffiliation; now: number }) {
    const { t } = useTranslation();
    const days = trialDay(player, now), label = t(`squadDesign.players.status.${player.status}`, { defaultValue: player.status });
    return <Status tone={days !== null && days > TRIAL_LIMIT_DAYS ? 'danger' : statusTone[player.status] ?? 'neutral'}>
        {days !== null ? t('squadDesign.players.trialDay', { defaultValue: '{{status}} · day {{count}}', status: label, count: days }) : label}
    </Status>;
}

/** Parent consent in words; nothing to show when the player needs none. */
export function PlayerConsent({ player, needed }: { player: ClubPlayerAffiliation; needed: boolean }) {
    const { t } = useTranslation();
    const consent = player.parentalConsentStatus;
    if (consent === 'CONFIRMED') return <Status tone="accent">{t('squadDesign.players.consentConfirmed', { defaultValue: 'Consent confirmed' })}</Status>;
    if (consent === 'DECLINED') return <Status tone="danger">{t('minors.playersTab.consentDeclined')}</Status>;
    if (consent === 'EXPIRED') return <Status tone="danger">{t('minors.playersTab.consentExpired')}</Status>;
    if (consent === 'PENDING') return <Status tone="info">{t('minors.playersTab.consentPending')}</Status>;
    if (needed) return <Status tone="warning">{t('squadDesign.players.consentNeeded', { defaultValue: 'Consent needed' })}</Status>;
    return EMPTY_CELL;
}

/** The row's next step: a joining decision stays in view; a message appears when the row is pointed at. */
export function PlayerActions({ player, actions, admissionManaged }: { player: ClubPlayerAffiliation; actions: PlayerRowActions; admissionManaged: boolean }) {
    const { t } = useTranslation();
    const copy = (key: string, fallback: string, values?: Record<string, unknown>) => t(`squadDesign.players.${key}`, { defaultValue: fallback, ...values });
    const name = playerName(player), trialist = player.status === 'TRIALIST', canManage = actions.canManagePlayerStatuses;
    return <>
        {admissionManaged && actions.onReviewJoining
            ? <Button size="sm" className="gk-dt__keep" onClick={() => actions.onReviewJoining!(player.userId)}>{trialist ? copy('viewTerms', 'View agreed terms') : copy('reviewPlacement', 'Review placement')}</Button>
            : trialist && (actions.onReviewJoining || canManage
                ? <Button size="sm" className="gk-dt__keep" onClick={() => actions.onReviewJoining ? actions.onReviewJoining(player.userId) : actions.onOpenAdmissions()}>{copy('reviewJoining', 'Review joining')}</Button>
                : <span className="pl-quiet gk-dt__keep" title={copy('reviewOnlyHint', 'Only club owners and admins can finalise player status.')}>{copy('reviewOnly', 'Review only')}</span>)}
        {player.status === 'ACTIVE' && actions.onMessagePlayer && <Button size="sm" variant="ghost" iconOnly aria-label={copy('message', 'Message {{name}}', { name })} title={copy('message', 'Message {{name}}', { name })}
            onClick={() => actions.onMessagePlayer!(player.userId, player.fullName || undefined)}><MessageSquare aria-hidden="true" /></Button>}
    </>;
}

/**
 * What opens under a player's row: the trial end date, parent consent and status changes. Taking a player out of the
 * club or its squads is confirmed (with a note) by the workspace before anything changes. A player whose joining is
 * handled by an admission arrangement is changed there, not here.
 */
export function PlayerDetails({ player, actions, admissionManaged }: { player: ClubPlayerAffiliation; actions: PlayerRowActions; admissionManaged: boolean }) {
    const { t } = useTranslation();
    const [emailOpen, setEmailOpen] = useState(false), [email, setEmail] = useState('');
    const copy = (key: string, fallback: string, values?: Record<string, unknown>) => t(`squadDesign.players.${key}`, { defaultValue: fallback, ...values });
    const name = playerName(player), { pendingKey, canManagePlayerStatuses: canManage } = actions;
    const { trialist, consentToSend, canResend, changes } = playerChoices(player, actions, admissionManaged);
    const sending = pendingKey === `consent-${player.userId}`;
    const changeLabel: Record<string, string> = { TRIALIST: copy('demote', 'Move back to trial'), PAST: copy('markPast', 'Mark as past player'), REMOVED: trialist ? t('trialists.release') : copy('remove', 'Remove from club') };
    const send = async () => {
        const sent = await actions.onSendConsentEmail?.(player.userId, email.trim());
        if (sent !== false) { setEmailOpen(false); setEmail(''); }
    };
    return <div className="pl-details">
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
        {changes.length > 0 && <div className="gk-row pl-status-actions">{changes.map(status => <Button key={status} size="sm" variant={status === 'TRIALIST' ? 'secondary' : 'danger'}
            disabled={pendingKey === `player-${player.userId}-${status}`} onClick={() => void actions.onPlayerStatusChange(player.userId, status, player.fullName || undefined)}>{changeLabel[status]}</Button>)}</div>}
    </div>;
}
