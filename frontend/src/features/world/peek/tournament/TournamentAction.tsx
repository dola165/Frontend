import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../../utils/authRedirect';
import { usePlayerEntryEligibility } from '../../../competitions/usePlayerEntryEligibility';
import { entryGate } from '../../../tournaments/entryGates';
import { useArrangeableSquadsState } from '../../compose/useArrangeableSquads';
import { useWorldCopy } from '../../copy';
import { shortDate } from '../../format';
import { zoned } from '../../scoreboard/standings';
import { useNow } from '../../scoreboard/useNow';
import { clearNotice, readNotice } from '../stepNotice';
import { AnswerStep, EnteredStep, EnterStep, RegisterStep } from './TournamentSteps';
import { organiserWork, type TournamentPaneData } from './tournamentPane';
import '../step.css';

const instant = (value?: string | null) => { const at = zoned(value); return at ? Date.parse(at) : null; };

/**
 * The one thing to do about a tournament now, by the backend's rules (`entryGate`): for its staff, the work waiting in
 * the workspace; my entry and how it stands; an invitation to answer; entering, or registering for a players'
 * tournament; else why not, in words. What a step just did is said first and focused.
 */
export function TournamentAction({ data, reload }: { data: TournamentPaneData; reload: () => void }) {
    const t = useWorldCopy();
    const location = useLocation();
    const { status, user } = useAuth();
    const { squads } = useArrangeableSquadsState();
    const signedIn = status === 'authenticated';
    const player = usePlayerEntryEligibility(user?.id ?? null, signedIn && data.detail.participantScope === 'PLAYER' && data.detail.status === 'PLANNING');
    const now = useNow();
    const [notice] = useState(readNotice);
    useEffect(() => clearNotice(), []);
    const gate = entryGate({
        detail: data.detail, signedIn, userId: user?.id ?? null, canManage: data.canManage, squads, invitation: data.invitation, time: instant, now,
        playerEligible: player.status === 'ready' ? player.eligible : player.status === 'error' ? false : undefined,
    });
    const work = gate.kind === 'workspace' ? organiserWork(data.detail, now) : [];
    const step = gate.kind === 'entered' ? <EnteredStep data={data} gate={gate} reload={reload} />
        : gate.kind === 'answer' ? <AnswerStep data={data} gate={gate} squads={squads} reload={reload} />
        : gate.kind === 'enter' ? <EnterStep data={data} gate={gate} reload={reload} />
        : gate.kind === 'register' ? <RegisterStep data={data} gate={gate} reload={reload} />
        : gate.kind === 'reason' ? (gate.reason === 'sign-in'
            ? <Link className="gk-step-line" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}><span>{t('Sign in to enter a team')}</span><b>{t('Sign in')}</b><ArrowRight aria-hidden="true" /></Link>
            : <p className="gk-step-line" data-tone="quiet"><span>{gate.reason === 'not-open' ? t('Entries open {date}', { date: shortDate(zoned(gate.date)) ?? '' })
                : gate.reason === 'closed' ? t('Entries are closed') : t('By invitation only: the organiser invites the teams.')}</span></p>)
        : null;
    if (!notice && !step && !work.length) return null;
    return (
        <section className="gk-tpane-action">
            {notice && <p className="gk-step__done" role="status" tabIndex={-1} ref={node => node?.focus({ preventScroll: true })}>{notice}</p>}
            {step}
            {work.map(item => (
                <Link key={item.view} className="gk-step-line" to={`/tournaments/${data.detail.id}/workspace?view=${item.view}`}>
                    <span>{t(item.label, { count: item.count })}</span><b>{t('Open in the workspace')}</b><ArrowRight aria-hidden="true" />
                </Link>
            ))}
        </section>
    );
}
