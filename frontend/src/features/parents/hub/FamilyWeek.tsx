import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Section, Skeleton } from '../../../design/primitives';
import * as api from '../../squadCommunication/api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { JoiningChild } from '../api';
import { FamilySchedule } from '../FamilySchedule';
import { childWaiting, firstName, type WaitingItem } from './childFacts';
import { visitEvents } from './familyEvents';
import { useFamilySquads } from './useChildSquads';
import type { FamilyMember } from './useFamilySchedule';
import { WaitingForYou } from './WaitingForYou';
import './parent-hub.css';

/**
 * Everyone (two or more children): a short "Waiting for you" (only what truly waits) and the one calendar with every
 * child's sessions, each marked with their initial, first visits in pink. Pressing a child opens their page. Squads that
 * failed to load are named with Try again, beside what did load; a failed week never reads as an empty one.
 */
export function FamilyWeek({ children, sessionId, revision }: { children: JoiningChild[]; sessionId: AuthSessionId; revision: number }) {
    const copy = useJourneyCopy();
    const { squads, loading, error, failedSquads, retry } = useFamilySquads(children, revision, sessionId);
    const members: FamilyMember[] = useMemo(() => children.map(child => ({ playerId: child.playerId, name: firstName(child), squads: (squads.get(child.playerId) ?? []).map(squad => ({ ...squad, can_manage: false })) }))
        .filter(member => member.squads.length), [children, squads]);
    const toRead = useUpdatesToRead(children, squads, revision);
    const waiting = [...toRead, ...children.flatMap(child => childWaiting(child, copy))];
    const visits = useMemo(() => children.flatMap(child => visitEvents(child, copy)), [children, copy]);
    const allSquads = [...new Map(members.flatMap(m => m.squads).map(squad => [squad.id, squad])).values()];
    return <div className="ph-family">
        <WaitingForYou items={waiting} />
        <Section boxed icon={CalendarDays} tone="info" title={copy('This week', 'ეს კვირა')} hint={copy('Everyone’s sessions, each with their initial', 'ყველას ვარჯიშები, თითოეულის ინიციალით')} className="ph-section ph-week" id="family-week">
            {error && <p className="ph-quiet" role="alert">{failedSquads.length ? `${copy('Some squads couldn’t load:', 'ზოგი გუნდი ვერ ჩაიტვირთა:')} ${failedSquads.join(' · ')}` : copy('Couldn’t load the squads.', 'გუნდები ვერ ჩაიტვირთა.')}
                {' '}<button type="button" className="ph-link" onClick={retry}>{copy('Try again', 'ხელახლა ცდა')}</button></p>}
            {loading && !members.length ? <Skeleton height={220} />
                : members.length || visits.length ? <div data-guide="family-week"><FamilySchedule squads={allSquads} members={members} extraEvents={visits} embedded combined optOut /></div>
                    : !error && <p className="ph-quiet">{copy('Nothing planned yet. When a coach plans a session, it shows here.', 'ჯერ არაფერია დაგეგმილი. მწვრთნელის დაგეგმილი ვარჯიში აქ გამოჩნდება.')}</p>}
        </Section>
    </div>;
}

/** Updates a coach asked the family to read and nobody has yet, across every child's squads. */
function useUpdatesToRead(children: JoiningChild[], squads: Map<number, api.SquadOverview[]>, revision: number): WaitingItem[] {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<WaitingItem[]>([]);
    const pairs = children.flatMap(child => (squads.get(child.playerId) ?? []).map(squad => ({ child, squad })));
    const key = `${pairs.map(p => `${p.child.playerId}:${p.squad.id}`).join(',')}:${revision}`;
    useEffect(() => {
        const abort = new AbortController();
        const bySquad = new Map(pairs.map(p => [p.squad.id, p]));
        void Promise.allSettled([...bySquad.values()].map(async ({ child, squad }) => (await api.messages(squad.id, 'ANNOUNCEMENT', null, abort.signal))
            .filter(m => m.acknowledgement_requested && !m.acknowledged_at)
            .map((m): WaitingItem => ({ key: `read-${squad.id}-${m.id}`, tone: 'decide', text: copy(`${m.author_name.split(' ')[0]} asked everyone to read “${m.title ?? m.body.slice(0, 40)}”`, `${m.author_name.split(' ')[0]} ყველას სთხოვს წაიკითხოს „${m.title ?? m.body.slice(0, 40)}“`),
                detail: `${firstName(child)} · ${squad.name}`, to: `/parent?player=${child.playerId}#updates`, action: copy('Read it', 'წაკითხვა') }))))
            .then(results => { if (!abort.signal.aborted) setItems(results.flatMap(r => r.status === 'fulfilled' ? r.value : [])); });
        return () => abort.abort();
        // `key` names the squads and the revision.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, copy]);
    return items;
}
