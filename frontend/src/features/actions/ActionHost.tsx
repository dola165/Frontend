import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { AdultOnlyNote } from '../../components/access/AdultOnlyNote';
import { accessibleClubs } from '../../components/layout/clubAccess';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import { createHref, ownClub } from '../pages/create/entry';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ACTIONS, actionNumber, actionText, DO_PARAM, isActionKey, openedHere, withoutAction, type ActionKey, type ActionSubject } from './registry';
import { useAction } from './useAction';

const ArrangeFlow = lazy(() => import('./flows/MatchFlows').then(module => ({ default: module.ArrangeFlow })));
const ScoreFlow = lazy(() => import('./flows/MatchFlows').then(module => ({ default: module.ScoreFlow })));
const AddChildFlow = lazy(() => import('./flows/FamilyFlows').then(module => ({ default: module.AddChildFlow })));
const JoinCodeFlow = lazy(() => import('./flows/FamilyFlows').then(module => ({ default: module.JoinCodeFlow })));
const InviteStaffFlow = lazy(() => import('./flows/StaffFlows').then(module => ({ default: module.InviteStaffFlow })));
const SuggestFlow = lazy(() => import('./flows/StaffFlows').then(module => ({ default: module.SuggestFlow })));

/**
 * Mounted once in the app shell beside the start sheet: opens an action's flow over the current page when the address
 * says `?do=<key>` (from a button, a link someone shared, a notification), with its answers in `do-…`. Closing drops
 * them, so Back, a reload and a shared link all agree. Signed out, it asks to sign in first and comes back.
 */
export function ActionHost() {
    const location = useLocation();
    const { status } = useAuth();
    const key = new URLSearchParams(location.search).get(DO_PARAM);
    if (!isActionKey(key) || status === 'bootstrapping') return null;
    if (status !== 'authenticated') return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
    return <OpenAction key={key} action={key} />;
}

function OpenAction({ action }: { action: ActionKey }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const copy = useJourneyCopy();
    const params = new URLSearchParams(location.search);
    const squadId = actionNumber(params, 'squad');
    const club = actionNumber(params, 'club') ?? ownClub(user?.navigationCapabilities)?.id;
    const subject: ActionSubject = squadId ? { kind: 'squad', id: squadId, clubId: club } : club && (action === 'invite_staff' || action === 'suggest_assistant') ? { kind: 'club', id: club } : { kind: 'me' };
    const state = useAction(action, subject);
    // Once the person has typed in the flow, a refusal that arrives late never takes the form away: the server refuses on submit.
    const [typed, setTyped] = useState(false);
    const rest = { pathname: location.pathname, search: withoutAction(location.search), hash: location.hash };
    // Back to the page it opened over: one step back when a button here opened it, else the same address without it.
    const close = () => { if (openedHere(location.state)) navigate(-1); else navigate(rest, { replace: true }); };
    // Starting a club is the one create sheet; following has no flow (it is a toggle where the club is shown).
    const handOver = action === 'start_club' && state.allowed ? createHref(rest, 'CLUB', 'start') : action === 'follow' ? `${rest.pathname}${rest.search}${rest.hash}` : null;
    useEffect(() => { if (handOver) navigate(handOver, { replace: true }); }, [handOver, navigate]);
    if (handOver) return null;
    if (!state.allowed && !typed) return state.loading ? null : <Dialog open size="sm" title={copy(...ACTIONS[action].label)} onClose={close} closeLabel={copy('Close', 'დახურვა')}
        footer={<Button variant="primary" onClick={close}>{copy('Close', 'დახურვა')}</Button>}>
        {state.reason || state.needsBirthDate ? <AdultOnlyNote adult={state} /> : <p>{copy('This isn’t open to you here.', 'ეს აქ თქვენთვის ხელმისაწვდომი არ არის.')}</p>}
    </Dialog>;
    const clubName = accessibleClubs(user?.navigationCapabilities).find(item => item.id === club)?.name ?? '';
    const flow = action === 'arrange_match' ? <ArrangeFlow squadId={squadId} opponentId={actionNumber(params, 'opponent')} onClose={close} />
        : action === 'report_score' ? <ScoreFlow source={actionText(params, 'source')} eventId={actionNumber(params, 'event')} squadId={squadId} onClose={close} />
        : action === 'add_child' ? <AddChildFlow onClose={close} />
        : action === 'join_squad' ? <JoinCodeFlow code={actionText(params, 'code')} playerId={actionNumber(params, 'player')} onClose={close} />
        : action === 'invite_staff' && club ? <InviteStaffFlow club={club} clubName={clubName} squadId={squadId} job={actionText(params, 'job')} onClose={close} />
        : action === 'suggest_assistant' && club ? <SuggestFlow club={club} squadId={squadId} onClose={close} />
        : null;
    // Input inside the flow's dialog bubbles here through the portal.
    return <div className="gk-action-host" onInput={() => setTyped(true)}><Suspense fallback={null}>{flow}</Suspense></div>;
}
