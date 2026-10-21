import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { Button, ButtonLink, GkRoot, PageFrame, Skeleton } from '../../../design/primitives';
import { Tabs } from '../../../design/Tabs';
import { useUrlTab } from '../../../design/useUrlTab';
import { Crest, FaceStack } from '../../../design/visuals';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../api';
import { useJourneyCopy } from '../journeyCopy';
import { squadMessageUrl } from '../routes';
import { useClubCrest } from '../useClubCrest';
import { SquadUpdatesTab } from './SquadUpdatesTab';
import { SquadScheduleTab } from './SquadScheduleTab';
import { SquadPlayersTab } from './SquadPlayersTab';
import { SquadGroundsTab } from './SquadGroundsTab';
import { useViewerChildren } from './useViewerChildren';
import './squad-page.css';

const TABS = ['updates', 'schedule', 'players', 'grounds'] as const;
export type SquadTab = typeof TABS[number];
const LEGACY: Record<string, SquadTab> = { announcements: 'updates', sessions: 'schedule' };

/**
 * One squad page, two ways in (the owner's model, SQUAD_PAGE_AND_FAMILY.md): parents open it through their child in
 * Parent Hub, coaches through My squads. Everyone sees the same updates, schedule, players and grounds; the coach
 * manages the squad (post updates, see who acknowledged, talk to one parent, invite, approve, remove from the squad)
 * and the parent manages their child (reply for them, talk to the coaches). A parent who coaches gets both.
 * `embedded` leaves out the page frame and back link when My squads frames it.
 */
export function SquadPage({ id, embedded = false }: { id: number; embedded?: boolean }) {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    // Framed by My squads, whose own menu reads `tab`, the page keeps its tab in `view`.
    const key = embedded ? 'view' : 'tab';
    const legacy = LEGACY[params.get(key) ?? ''];
    const [tab, setTab] = useUrlTab<SquadTab>(key, TABS, 'updates');
    const [space, setSpace] = useState<api.SquadOverview | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const refresh = () => setRevision(n => n + 1);
    useEffect(() => {
        if (!legacy) return;
        const next = new URLSearchParams(params); next.set(key, legacy); setParams(next, { replace: true });
    }, [legacy, key, params, setParams]);
    useEffect(() => {
        let active = true; const abort = new AbortController();
        const load = () => { if (document.hidden) return; void api.overview(id, abort.signal).then(s => { if (active) { setSpace(s); setError(''); } }).catch(e => { if (active) { setSpace(null); setError(extractApiErrorMessage(e, copy('We could not open this squad. Please try again.', 'გუნდის გვერდი ვერ გაიხსნა. სცადეთ ხელახლა.'))); } }); };
        load(); const timer = setInterval(load, 15000);
        return () => { active = false; abort.abort(); clearInterval(timer); };
    }, [id, revision, copy]);
    const children = useViewerChildren(space);
    const crest = useClubCrest(space?.club_id);
    const playerParam = Number(params.get('player'));
    const child = children.find(item => item.playerId === playerParam) ?? children[0];
    // Back to where the person came from: Parent Hub carries the child in the address, My squads does not.
    const back = space?.can_manage && !params.has('player') ? { to: '/my-squads', label: copy('My squads', 'ჩემი გუნდები') } : { to: child ? `/parent?player=${child.playerId}` : '/parent', label: copy('Parent Hub', 'მშობლის სივრცე') };
    if (params.get(key) === 'chat' || params.get(key) === 'coach' || (!embedded && params.has('thread'))) return <Navigate replace to={squadMessageUrl(id, params.get(key) !== 'chat', Number(params.get('thread')) || null)} />;
    const frame = (body: ReactNode) => embedded ? <div className="sp">{body}</div> : <GkRoot className="gk-page sp"><PageFrame>
        <Link className="sp-back" to={back.to}><ArrowLeft aria-hidden="true" />{back.label}</Link>{body}</PageFrame></GkRoot>;
    if (error) return frame(<div role="alert" className="sp-empty"><h1>{copy('Squad page unavailable', 'გუნდის გვერდი მიუწვდომელია')}</h1><p>{error}</p><button type="button" className="sp-link" onClick={refresh}>{copy('Try again', 'ხელახლა ცდა')}</button></div>);
    if (!space) return frame(<div className="sp-stack" role="status"><Skeleton height={72} /><Skeleton height={44} /><Skeleton height={240} /></div>);
    const coaches = space.coaches.map(coach => ({ id: coach.user_id, name: coach.full_name }));
    const head = space.coaches.find(coach => coach.user_id === space.head_coach_id) ?? space.coaches[0];
    const childFirst = child?.identity.fullName.split(' ')[0];
    return frame(<>
        <header className="sp-head">
            <Crest src={crest} name={space.academy_name} size={52} />
            <div className="sp-head__text">
                <h1>{space.name}</h1>
                <p><Link to={`/clubs/${space.club_id}`}>{space.academy_name}</Link> · {copy(`${space.players.length} players`, `${space.players.length} მოთამაშე`)}{childFirst ? <> · <strong className="sp-head__child">{copy(`${childFirst}’s squad`, `${childFirst}-ს გუნდი`)}</strong></> : null}</p>
            </div>
            <div className="sp-head__coaches" title={coaches.map(c => c.name).join(', ')}><FaceStack people={coaches} max={3} size={30} label={copy('Coaches', 'მწვრთნელები')} /><span>{head?.full_name}{coaches.length > 1 ? ` +${coaches.length - 1}` : ''}</span></div>
            <div className="sp-head__actions">
                {space.can_manage && <Button variant="primary" onClick={() => { const next = new URLSearchParams(params); next.set(key, 'schedule'); next.set('setup', 'training'); setParams(next); }}>{copy('Set up training', 'ვარჯიშის დაგეგმვა')}</Button>}
                <ButtonLink to={squadMessageUrl(space.id)}><MessageCircle aria-hidden="true" />{copy('Squad chat', 'გუნდის ჩატი')}</ButtonLink>
                {!space.can_manage && <ButtonLink variant="primary" to={squadMessageUrl(space.id, true)}><Send aria-hidden="true" />{copy('Message the coaches', 'მისწერეთ მწვრთნელებს')}</ButtonLink>}
            </div>
        </header>
        <Tabs<SquadTab> label={copy('Squad page', 'გუნდის გვერდი')} value={tab} onChange={setTab} idBase="squad"
            items={[{ id: 'updates', label: copy('Updates', 'განახლებები') }, { id: 'schedule', label: copy('Schedule', 'განრიგი') }, { id: 'players', label: copy('Players', 'მოთამაშეები'), count: space.players.length }, { id: 'grounds', label: copy('Grounds', 'მოედნები') }]} />
        <div id={`squad-${tab}-panel`} role="tabpanel" aria-labelledby={`squad-${tab}`} className="sp-panel">
            {tab === 'updates' ? <SquadUpdatesTab space={space} child={child} crest={crest} tabKey={key} onChanged={refresh} />
                : tab === 'schedule' ? <SquadScheduleTab space={space} childId={child?.playerId} />
                : tab === 'players' ? <SquadPlayersTab space={space} crest={crest} childIds={children.map(item => item.playerId)} onChanged={refresh} />
                : <SquadGroundsTab space={space} childId={child?.playerId} />}
        </div>
    </>);
}
